import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

// ローカル開発環境の場合は自動的にFirebaseエミュレータを指すように設定
if (process.env.NODE_ENV !== "production") {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    console.log(`[Firestore] Automatically configured emulator host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    console.log(`[Auth] Automatically configured emulator host: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  }
}

if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
  } catch (e) {
    console.warn("Firebase admin initialization failed:", e);
  }
}

const firestore = admin.firestore();

// Initialize Express
const app = express();
const PORT = 3000;

// High body limits for uploading base64 crop photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// System-wide Types
import { 
  User, System, SystemMember, Plant, GrowLog, PlantPhoto, 
  NutrientLog, ChatMessage, ScheduleProposal, HarvestPrediction,
  SystemType, isSoilSystem
} from "./src/types";

interface DBStructure {
  users: User[];
  systems: System[];
  plants: Plant[];
  systemMembers: SystemMember[];
  growLogs: GrowLog[];
  plantPhotos: PlantPhoto[];
  nutrientLogs: NutrientLog[];
  chatMessages: ChatMessage[];
  scheduleProposals: ScheduleProposal[];
  weatherAdviceCache?: {
    [location: string]: {
      date: string;
      content: string;
    };
  };
  harvestPredictions?: HarvestPrediction[];
  lastHarvestCalculationAt?: string;
}

async function readDB(): Promise<DBStructure> {
  try {
    const collections = [
      "users", "systems", "plants", "systemMembers", 
      "growLogs", "plantPhotos", "chatMessages", 
      "scheduleProposals", "harvestPredictions"
    ];
    
    const dbData: any = {};
    
    // Read all collections in parallel
    await Promise.all(collections.map(async (col) => {
      const snapshot = await firestore.collection(col).get();
      dbData[col] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }));
    
    // Read weatherAdviceCache Map
    const weatherSnap = await firestore.collection("weatherAdviceCache").get();
    const weatherAdviceCache: any = {};
    weatherSnap.docs.forEach(doc => {
      weatherAdviceCache[doc.id] = doc.data();
    });
    dbData.weatherAdviceCache = weatherAdviceCache;
    
    // Read metadata doc
    const metaSnap = await firestore.collection("metadata").doc("appState").get();
    if (metaSnap.exists) {
      const metaData = metaSnap.data() || {};
      dbData.lastHarvestCalculationAt = metaData.lastHarvestCalculationAt || "";
    } else {
      dbData.lastHarvestCalculationAt = "";
    }
    
    dbData.nutrientLogs = []; // satisfies DBStructure
    
    // If Firestore has no users, return empty DBStructure
    if (dbData.users.length === 0) {
      console.log("Firestore is empty. Returning empty DBStructure...");
      return {
        users: [],
        systems: [],
        plants: [],
        systemMembers: [],
        growLogs: [],
        plantPhotos: [],
        nutrientLogs: [],
        chatMessages: [],
        scheduleProposals: [],
        weatherAdviceCache: {},
        harvestPredictions: [],
        lastHarvestCalculationAt: ""
      };
    }
    
    return dbData as DBStructure;
  } catch (error) {
    console.error("Failed to read database from Firestore:", error);
    throw error;
  }
}

async function writeDB(data: DBStructure): Promise<void> {
  try {
    const collections = [
      "users", "systems", "plants", "systemMembers", 
      "growLogs", "plantPhotos", "chatMessages", 
      "scheduleProposals", "harvestPredictions"
    ];
    
    // Sync all primary collections
    await Promise.all(collections.map(async (col) => {
      const snapshot = await firestore.collection(col).get();
      const existingIds = snapshot.docs.map(doc => doc.id);
      
      const newItems = (data as any)[col] || [];
      const newIds = newItems.map((item: any) => item.id);
      
      // Calculate deletes
      const idsToDelete = existingIds.filter(id => !newIds.includes(id));
      
      const promises: Promise<any>[] = [];
      
      // Delete missing docs
      idsToDelete.forEach(id => {
        promises.push(firestore.collection(col).doc(id).delete());
      });
      
      // Save/Update new/existing docs
      newItems.forEach((item: any) => {
        const { id, ...rest } = item;
        const cleaned = JSON.parse(JSON.stringify(rest));
        promises.push(firestore.collection(col).doc(id).set(cleaned));
      });
      
      await Promise.all(promises);
    }));
    
    // Sync weatherAdviceCache Map
    const weatherSnapshot = await firestore.collection("weatherAdviceCache").get();
    const existingWeatherKeys = weatherSnapshot.docs.map(doc => doc.id);
    
    const newWeatherCache = data.weatherAdviceCache || {};
    const newWeatherKeys = Object.keys(newWeatherCache);
    
    const weatherPromises: Promise<any>[] = [];
    
    // Delete missing weather caches
    existingWeatherKeys.filter(k => !newWeatherKeys.includes(k)).forEach(k => {
      weatherPromises.push(firestore.collection("weatherAdviceCache").doc(k).delete());
    });
    
    // Set new weather caches
    newWeatherKeys.forEach(k => {
      const cleaned = JSON.parse(JSON.stringify(newWeatherCache[k]));
      weatherPromises.push(firestore.collection("weatherAdviceCache").doc(k).set(cleaned));
    });
    
    await Promise.all(weatherPromises);
    
    // Sync metadata doc
    await firestore.collection("metadata").doc("appState").set({
      lastHarvestCalculationAt: data.lastHarvestCalculationAt || ""
    });
    
    console.log("Successfully wrote database state to Firestore.");
  } catch (err) {
    console.error("Failed to write database to Firestore:", err);
    throw err;
  }
}



let geminiClient: any = null;
if (process.env.GEMINI_API_KEY) {
  geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Helper to get user context from request (mock or real)
async function getUserContext(req: express.Request): Promise<User> {
  const token = req.headers.authorization?.split(" ")[1];
  const currentDb = await readDB();
  if (token) {
    const user = currentDb.users.find(u => u.id === token);
    if (user) return user;
  }
  let defaultUser = currentDb.users.find(u => u.id === "user-1");
  if (!defaultUser) {
    defaultUser = {
      id: "user-1",
      email: "choco.rgi.duck@gmail.com",
      name: "栽培マスター",
      createdAt: new Date().toISOString()
    };
  }
  return defaultUser;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, idToken } = req.body;
  
  if (idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const decodedEmail = decodedToken.email;
      const name = decodedToken.name || decodedToken.email?.split("@")[0] || "栽培仲間";
      const uid = decodedToken.uid;

      if (!decodedEmail) {
        return res.status(400).json({ error: "Googleアカウントにメールアドレスが存在しません" });
      }

      const currentDb = await readDB();
      let user = currentDb.users.find(u => u.email.toLowerCase() === decodedEmail.toLowerCase());

      if (!user) {
        user = {
          id: uid,
          email: decodedEmail.toLowerCase(),
          name,
          createdAt: new Date().toISOString()
        };
        currentDb.users.push(user);
        await writeDB(currentDb);
      } else if (user.id !== uid) {
        user.id = uid;
        await writeDB(currentDb);
      }

      return res.json({ user, token: uid });
    } catch (error: any) {
      console.error("ID Token verification failed in login:", error);
      return res.status(401).json({ error: "認証に失敗しました。ログインし直してください。" });
    }
  }

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = await readDB();
  const normalizedEmail = email.toLowerCase();
  
  if (normalizedEmail === "demo@example.com") {
    let demoUser = currentDb.users.find(u => u.id === "user-1");
    if (!demoUser) {
      demoUser = {
        id: "user-1",
        email: "demo@example.com",
        name: "デモユーザー",
        createdAt: new Date().toISOString()
      };
      currentDb.users.push(demoUser);
    } else {
      demoUser.email = "demo@example.com";
      demoUser.name = "デモユーザー";
    }
    await writeDB(currentDb);
    return res.json({ user: demoUser, token: "user-1" });
  }
  
  let user = currentDb.users.find(u => u.email.toLowerCase() === normalizedEmail);
  
  if (!user) {
    const parts = normalizedEmail.split("@");
    user = {
      id: "user-" + Date.now(),
      email: normalizedEmail,
      name: parts[0] || "栽培仲間",
      createdAt: new Date().toISOString()
    };
    currentDb.users.push(user);
    await writeDB(currentDb);
  }
  
  res.json({ user, token: user.id });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, name, idToken } = req.body;

  if (idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const decodedEmail = decodedToken.email || email;
      const decodedName = decodedToken.name || name || "栽培仲間";
      const uid = decodedToken.uid;

      const currentDb = await readDB();
      let user = currentDb.users.find(u => u.email.toLowerCase() === decodedEmail.toLowerCase());

      if (!user) {
        user = {
          id: uid,
          email: decodedEmail.toLowerCase(),
          name: decodedName,
          createdAt: new Date().toISOString()
        };
        currentDb.users.push(user);
        await writeDB(currentDb);
      } else if (user.id !== uid) {
        user.id = uid;
        await writeDB(currentDb);
      }
      return res.json({ user, token: uid });
    } catch (e) {
      return res.status(401).json({ error: "Token verification failed in registration" });
    }
  }

  if (!email || !name) {
    return res.status(400).json({ error: "Email and Name are required" });
  }

  const currentDb = await readDB();
  const exists = currentDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "ユーザーは既に存在します" });
  }

  const newUser: User = {
    id: "user-" + Date.now(),
    email: email.toLowerCase(),
    name,
    createdAt: new Date().toISOString()
  };
  currentDb.users.push(newUser);
  await writeDB(currentDb);
  return res.json({ user: newUser, token: newUser.id });
});

app.get("/api/weather-advice", async (req, res) => {
  try {
    const user = await getUserContext(req);
    const location = (req.query.location as string || "長野県長野市").trim();
    const cacheKey = location.toLowerCase();
    const todayJst = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

    const currentDb = await readDB();
    if (!currentDb.weatherAdviceCache) {
      currentDb.weatherAdviceCache = {};
    }

    if (currentDb.weatherAdviceCache[cacheKey] && currentDb.weatherAdviceCache[cacheKey].date === todayJst) {
      return res.json({ advice: currentDb.weatherAdviceCache[cacheKey].content, date: todayJst, location });
    }

    let generatedAdvice = "";
    if (geminiClient) {
      try {
        const prompt = `あなたは親切なAI家庭菜園・園芸アドバイザーです。対象の地域「${location}」におけるこれからの気象予報に応じた、栽培者向けの具体的で役立つお世話のアドバイスを日本語で生成してください。

海外の華氏などは絶対にそのまま出力しないでください（生命や植物が生存できません）。
もし華氏「80°F」などの情報だった場合は、必ず摂氏に換算（(F - 32) * 5/9）して「26℃〜27℃」または「20℃台後半」と正しく記述してください。日本の一般的な季節に応じた摂氏（目安として春〜秋なら15℃〜35℃程度）であることを絶対に確認してください。

園芸、家庭菜園、または温室・プランター栽培の観点で、明日またはこれからの気候に合わせた、栽培者向けの具体的で役立つお世話アドバイスや警告メッセージ（例：「明日は晴れて気温が20℃台後半まで上がる見込みです。日差しが強くなる時間帯もあるため、鉢植えの土の乾き具合をこまめにチェックし、水切れに注意しましょう」など）を2〜3文程度で簡潔に生成してください。

【出力ルール】
- 栽培や天気に関する絵文字「🌱」「☀️」「⚠️」「☔️」などを適宜交え、日本語で温かみのある表現にしてください。
- 余計な説明、前置き、導入部分（「検索の結果…」「気象によると…」など）や挨拶文は一切含めず、「そのままお知らせバナーに表示」できるようなアドバイス文（2〜3文）だけを出力してください。`;

        const aiResponse = await geminiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "あなたは親切なAI家庭菜園・園芸アドバイザーです。ターゲット地域における最新の実際の気象予報を検索し、明日の栽培のお世話に必要なアドバイスを具体的・明確・簡潔に提示します。特に気温は絶対に摂氏（℃）に変換し、華氏（°F）をそのまま摂氏（℃）として記述するバグを徹底的に防止してください。",
            tools: [{ googleSearch: {} }]
          }
        });

        generatedAdvice = aiResponse.text?.trim() || "";
        if (!generatedAdvice) {
          generatedAdvice = "🌱【お知らせ】本日は通常のお手入れ（土の乾き具合に応じた水やり）を行ってください。";
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error("Weather advice Gemini call failed:", errMsg);
        generatedAdvice = "🌱【お知らせ】気象情報の取得中に一時的な接続障害が発生しました。本日は通常のお手入れ（プランターの土が乾いたらたっぷり水やり）を継続してください。";
      }
    } else {
      generatedAdvice = "🌱【お知らせ】AIサポートが未設定、またはAPIキーが無効です。プランターの土が乾いたらたっぷり水やりを行ってください。";
    }

    currentDb.weatherAdviceCache[cacheKey] = {
      date: todayJst,
      content: generatedAdvice
    };
    await writeDB(currentDb);
    return res.json({ advice: generatedAdvice, date: todayJst, location });
  } catch (err: any) {
    console.error("Weather advice error:", err);
    return res.status(500).json({ error: "Failed to fetch weather advice", details: err?.message || String(err) });
  }
});

app.get("/api/plants/harvest-predictions", async (req, res) => {
  try {
    const user = await getUserContext(req);
    const force = req.query.force === "true";
    const currentDb = await readDB();

    const now = new Date();
    let shouldCalculate = force;

    if (!shouldCalculate) {
      if (!currentDb.lastHarvestCalculationAt) {
        shouldCalculate = true;
      } else {
        const lastCalc = new Date(currentDb.lastHarvestCalculationAt);
        const hoursSinceLastCalc = (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastCalc >= 12) {
          shouldCalculate = true;
        }
      }
    }

    let geminiError = null;
    const activePlants = currentDb.plants.filter(p => p.userId === user.id && !p.archived && p.stage !== 'finished');
    currentDb.harvestPredictions = currentDb.harvestPredictions || [];

    if (shouldCalculate && activePlants.length > 0 && geminiClient) {
      try {
        console.log(`AI収穫予測を実行します... (対象植物数: ${activePlants.length}件)`);

        const plantsData = activePlants.map(p => {
          const logs = currentDb.growLogs
            .filter(l => l.plantId === p.id)
            .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
            .slice(0, 3);

          return {
            id: p.id,
            name: p.name,
            species: p.variety || p.name,
            stage: p.stage,
            plantedAt: p.sowingDate,
            targetHarvestDays: 60,
            growLogs: logs.map(l => ({ date: l.loggedAt, note: l.note }))
          };
        });

        const prompt = `以下の家庭菜園プランターで栽培中（アクティブ）の植物リストと最近の生長ログに基づき、各植物が「いつ頃収穫可能になるか（収穫予測日、YYYY-MM-DD）」とその「科学的・植物学的な予測根拠（200文字程度、日本語）」をAIの知見から推定・計算してください。

【対象植物リスト】
${JSON.stringify(plantsData, null, 2)}

【出力形式ルール（厳守）】
以下の純粋なJSON配列のみを返却してください。マークダウンの\`\`\`jsonなどの装飾や、前後のテキスト、挨拶などは一切含めないでください。パースエラーを防ぐため完璧なJSONフォーマットのみを記述してください。

[
  {
    "plantId": "植物のID（例: p-12345）",
    "calculatedHarvestDate": "収穫予測日（例: YYYY-MM-DD）",
    "reason": "植物の状態や播種日、経過日数、最近のログ情報に基づいた予測根拠と、今後のお世話のアドバイス（日本語、200文字程度）"
  }
]`;

        const aiResponse = await geminiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });

        const responseText = aiResponse.text?.trim() || "";
        console.log("Genei harvest predictions raw response:", responseText);

        let cleanJson = responseText;
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        const predictionsList = JSON.parse(cleanJson);
        if (Array.isArray(predictionsList)) {
          for (const pred of predictionsList) {
            if (pred && pred.plantId && pred.calculatedHarvestDate) {
              const existingIdx = currentDb.harvestPredictions.findIndex(hp => hp.plantId === pred.plantId);
              const predictionRecord = {
                id: "pred-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
                plantId: pred.plantId,
                calculatedHarvestDate: pred.calculatedHarvestDate,
                reason: pred.reason || "",
                updatedAt: new Date().toISOString()
              };

              if (existingIdx !== -1) {
                currentDb.harvestPredictions[existingIdx] = predictionRecord;
              } else {
                currentDb.harvestPredictions.push(predictionRecord);
              }
            }
          }
          currentDb.lastHarvestCalculationAt = now.toISOString();
          await writeDB(currentDb);
        }
      } catch (err: any) {
        console.error("AI harvest predictions calculation failed:", err);
        const rawErrorMsg = err?.message || String(err);
        if (rawErrorMsg.includes("503") || rawErrorMsg.includes("high demand") || rawErrorMsg.includes("UNAVAILABLE")) {
          geminiError = "現在、AIモデルへのリクエストが集中しているため、一時的に予測機能に制限がかかっております。安全にお世話ができるよう、標準的な栽培目安に基づいた自動フォールバック予測値を生成しました。";
        } else {
          geminiError = `予測計算時に一時的な接続エラーが発生しました。現在のお世話状況に基づき、自動フォールバック予測値を算出しました。`;
        }

        try {
          console.log("AI計算が失敗または高負荷のため、プランターの安全なルールベース植物収穫予測フォールバックを開始します...");
          const fallbackPredictions = activePlants.map(p => {
            let daysToHarvest = 60; // デフォルト栽培日数
            const nameLower = (p.name || "").toLowerCase();
            const varietyLower = (p.variety || "").toLowerCase();

            if (nameLower.includes("レタス") || varietyLower.includes("レタス")) {
              daysToHarvest = 40;
            } else if (nameLower.includes("トマト") || varietyLower.includes("トマト")) {
              daysToHarvest = 90;
            } else if (nameLower.includes("バジル") || varietyLower.includes("バジル")) {
              daysToHarvest = 45;
            } else if (nameLower.includes("ピーマン") || varietyLower.includes("ピーマン")) {
              daysToHarvest = 80;
            } else if (nameLower.includes("パクチー") || varietyLower.includes("パクチー")) {
              daysToHarvest = 50;
            }

            const sowingDateStr = p.sowingDate || new Date().toISOString().split("T")[0];
            const sowing = new Date(sowingDateStr);
            const calculated = new Date(sowing.getTime() + daysToHarvest * 24 * 60 * 60 * 1000);
            const calculatedStr = calculated.toISOString().split("T")[0];

            return {
              plantId: p.id,
              calculatedHarvestDate: calculatedStr,
              reason: `【栽培目安に基づく自動予測】現在、AIモデルが高負荷のため、標準的な栽培サイクル（およそ ${daysToHarvest} 日）と播種日（${sowingDateStr}）から算出した目安収穫日です。植物は現在「${p.stage === "seedling" ? "苗期" : p.stage === "vegetative" ? "生長期" : p.stage === "flowering" ? "開花期" : "実り期"}」段階にあります。引き続き日当たりやプランターの水切れにご注意ください。`
            };
          });

          for (const pred of fallbackPredictions) {
            const existingIdx = currentDb.harvestPredictions.findIndex(hp => hp.plantId === pred.plantId);
            const predictionRecord = {
              id: "pred-fallback-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
              plantId: pred.plantId,
              calculatedHarvestDate: pred.calculatedHarvestDate,
              reason: pred.reason,
              updatedAt: new Date().toISOString()
            };

            if (existingIdx !== -1) {
              currentDb.harvestPredictions[existingIdx] = predictionRecord;
            } else {
              currentDb.harvestPredictions.push(predictionRecord);
            }
          }
          currentDb.lastHarvestCalculationAt = now.toISOString();
          await writeDB(currentDb);
        } catch (fbErr) {
          console.error("Failed to generate harvest predictions fallback:", fbErr);
        }
      }
    }

    const dbNow = await readDB();
    const predictions = (dbNow.harvestPredictions || []).filter(hp =>
      dbNow.plants.some(p => p.id === hp.plantId && p.userId === user.id && !p.archived && p.stage !== 'finished')
    );

    return res.json({
      predictions,
      lastHarvestCalculationAt: dbNow.lastHarvestCalculationAt || "",
      calculatedThisTurn: shouldCalculate && !geminiError,
      geminiError
    });
  } catch (err: any) {
    console.error("Harvest predictions handler failed unexpectedly:", err);
    return res.status(500).json({ error: "Failed to load harvest predictions", details: err?.message || String(err) });
  }
});

// --- AUTH PROFILE & WEATHER-CURRENT SOLID REAL API ---
interface TempCacheEntry {
  temp: number;
  fetchedAt: number;
}
const currentTempCache: { [location: string]: TempCacheEntry } = {};
const TEMP_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

app.put("/api/auth/profile", async (req, res) => {
  const user = await getUserContext(req);
  const { name, showPhEc } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  
  const currentDb = await readDB();
  const idx = currentDb.users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    currentDb.users[idx].name = name;
    if (showPhEc !== undefined) {
      currentDb.users[idx].showPhEc = !!showPhEc;
    }
    currentDb.users[idx].updatedAt = new Date().toISOString();
    await writeDB(currentDb);
    return res.json({ user: currentDb.users[idx] });
  }
  res.status(404).json({ error: "User not found" });
});

app.get("/api/weather-current", async (req, res) => {
  try {
    const user = await getUserContext(req);
    const location = (req.query.location as string || "長野県長野市").trim();
    const cacheKey = location.toLowerCase();

    const now = Date.now();
    if (currentTempCache[cacheKey] && (now - currentTempCache[cacheKey].fetchedAt) < TEMP_CACHE_DURATION_MS) {
      console.log(`[Temp Cache Hit] Location: ${location}, Temp: ${currentTempCache[cacheKey].temp}℃`);
      return res.json({ temp: currentTempCache[cacheKey].temp });
    }
    
    let currentTemp = 20;
    
    let query = location;
    const parts = location.split(/[県都府道]/);
    if (parts.length > 1 && parts[1].trim().length > 0) {
      query = parts[1].trim();
    }
    
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=ja&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return res.status(502).json({ error: "位置情報検索API（外部サービス）への接続に失敗しました。ネットワークエラーの可能性があります。" });
    }
    
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: `「${location}」の位置情報を特定できませんでした。都道府県名や市区町村名を正しく指定してください。` });
    }
    
    const { latitude, longitude, name: resolvedName } = geoData.results[0];
    console.log(`[Open-Meteo Geocoding] Resolved "${location}" (query: "${query}") to ${resolvedName} (${latitude}, ${longitude})`);
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) {
      return res.status(502).json({ error: "現在の天気API（外部サービス）との通信に失敗しました。一時的なネットワーク障害の可能性があります。" });
    }
    
    const weatherData = await weatherRes.json();
    if (!weatherData.current || typeof weatherData.current.temperature_2m !== "number") {
      return res.status(502).json({ error: "天気情報データが不正です。外部APIエラーが発生した可能性があります。" });
    }
    
    currentTemp = Math.round(weatherData.current.temperature_2m * 10) / 10;
    console.log(`[Open-Meteo API Success] Location: ${location}, Temp: ${currentTemp}℃`);

    currentTempCache[cacheKey] = {
      temp: currentTemp,
      fetchedAt: now
    };

    res.json({ temp: currentTemp });
  } catch (err: any) {
    console.error("Weather current endpoint failed. Network error or dynamic failure:", err);
    res.status(502).json({ error: "天気情報取得中に外部APIへのネットワークエラーが発生しました。", details: err?.message || String(err) });
  }
});


// --- SYSTEMS ENDPOINTS ---
app.get("/api/systems", async (req, res) => {
  const user = await getUserContext(req);
  const currentDb = await readDB();
  
  // Find systems owned by the user OR where the user is a system member
  const jointSystemIds = currentDb.systemMembers
    .filter(sm => sm.userId === user.id)
    .map(sm => sm.systemId);
    
  const allowedSystems = currentDb.systems.filter(s => s.userId === user.id || jointSystemIds.includes(s.id));
  
  const results = allowedSystems.map(sys => {
    // Determine currentUserRole inside this system
    const isOwner = sys.userId === user.id;
    const dbRole = currentDb.systemMembers.find(sm => sm.systemId === sys.id && sm.userId === user.id)?.role;
    const currentUserRole = isOwner ? "owner" : (dbRole || "member");

    // Get owner details
    const ownerUser = currentDb.users.find(usr => usr.id === sys.userId);
    const ownerMemberArray = ownerUser ? [{
      userId: ownerUser.id,
      name: ownerUser.name,
      email: ownerUser.email,
      role: "owner",
      joinedAt: sys.createdAt || new Date().toISOString()
    }] : [];

    // Get other members of this system
    const otherMembers = currentDb.systemMembers
      .filter(sm => sm.systemId === sys.id && sm.userId !== sys.userId)
      .map(m => {
        const u = currentDb.users.find(usr => usr.id === m.userId);
        return {
          userId: m.userId,
          name: u ? u.name : "不明なユーザー",
          email: u ? u.email : "",
          role: m.role,
          joinedAt: m.joinedAt
        };
      });

    const members = [...ownerMemberArray, ...otherMembers];

    return {
      ...sys,
      members,
      currentUserRole
    };
  });

  res.json(results);
});

app.post("/api/systems", async (req, res) => {
  const user = await getUserContext(req);
  const { name, type, description } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: "Name and Type are required" });
  }
  
  const newSys: System = {
    id: "sys-" + Date.now(),
    userId: user.id,
    name,
    type,
    description: description || "",
    suspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const currentDb = await readDB();
  currentDb.systems.push(newSys);
  await writeDB(currentDb);
  res.status(210).json(newSys);
});

app.put("/api/systems/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { name, type, description, suspended } = req.body;
  
  const currentDb = await readDB();
  const idx = currentDb.systems.findIndex(s => s.id === id && s.userId === user.id);
  if (idx === -1) {
    return res.status(404).json({ error: "System not found or unauthorized" });
  }
  
  if (name) currentDb.systems[idx].name = name;
  if (type) currentDb.systems[idx].type = type;
  if (description !== undefined) currentDb.systems[idx].description = description;
  
  if (suspended !== undefined) {
    const wasSuspended = currentDb.systems[idx].suspended;
    currentDb.systems[idx].suspended = suspended;
    
    // If system is newly suspended, automatically archive all active plants in this system
    if (suspended && !wasSuspended) {
      currentDb.plants.forEach(p => {
        if (p.systemId === id && !p.archived) {
          p.archived = true;
          p.stage = "finished";
          p.updatedAt = new Date().toISOString();
        }
      });
    }
  }
  
  currentDb.systems[idx].updatedAt = new Date().toISOString();
  
  await writeDB(currentDb);
  res.json(currentDb.systems[idx]);
});

app.delete("/api/systems/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  
  const currentDb = await readDB();
  const sysIdx = currentDb.systems.findIndex(s => s.id === id && s.userId === user.id);
  if (sysIdx === -1) {
    return res.status(404).json({ error: "System not found" });
  }
  
  currentDb.systems.splice(sysIdx, 1);
  
  // To preserve database consistency, cascade delete all plants and their respective logs, photos, and chat histories linked to this system
  const plantsToRemove = currentDb.plants.filter(p => p.systemId === id);
  const plantIds = plantsToRemove.map(p => p.id);
  
  if (plantIds.length > 0) {
    currentDb.plants = currentDb.plants.filter(p => !plantIds.includes(p.id));
    currentDb.systemMembers = currentDb.systemMembers.filter(sm => sm.systemId !== id);
    currentDb.growLogs = currentDb.growLogs.filter(gl => !plantIds.includes(gl.plantId));
    currentDb.nutrientLogs = currentDb.nutrientLogs.filter(nl => !plantIds.includes(nl.plantId));
    currentDb.plantPhotos = currentDb.plantPhotos.filter(ph => !plantIds.includes(ph.plantId));
    currentDb.scheduleProposals = currentDb.scheduleProposals.filter(sp => !plantIds.includes(sp.plantId));
    currentDb.chatMessages = currentDb.chatMessages.filter(cm => !plantIds.includes(cm.plantId));
  }
  
  await writeDB(currentDb);
  res.json({ success: true });
});


// --- PLANTS & SHARING ENDPOINTS ---
app.get("/api/plants", async (req, res) => {
  const user = await getUserContext(req);
  const currentDb = await readDB();
  
  // Find plants in systems owned by the user OR where the user is a system member
  const systemIdsAllowed = currentDb.systemMembers
    .filter(sm => sm.userId === user.id)
    .map(sm => sm.systemId);

  const systemIdsOwned = currentDb.systems
    .filter(s => s.userId === user.id)
    .map(s => s.id);
    
  const allowedPlants = currentDb.plants.filter(p => 
    p.userId === user.id || 
    systemIdsOwned.includes(p.systemId) || 
    systemIdsAllowed.includes(p.systemId)
  );
  
  // Hydrate with latest stats (latest pH, EC, waterTemp) and systems details
  const results = allowedPlants.map(p => {
    const sys = currentDb.systems.find(s => s.id === p.systemId);
    const logs = currentDb.growLogs.filter(gl => gl.plantId === p.id);
    const sorted = [...logs].sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    const latest = sorted[0] || null;
    
    // Check if user is owner or member based on systemId
    const membership = currentDb.systemMembers.find(m => m.systemId === p.systemId && m.userId === user.id);
    const isSysOwner = sys && sys.userId === user.id;
    const photos = currentDb.plantPhotos.filter(ph => ph.plantId === p.id);
    return {
      ...p,
      systemName: sys ? sys.name : "不明なプランター",
      systemType: sys ? sys.type : "Other",
      latestPh: latest ? latest.ph : null,
      latestEc: latest ? latest.ec : null,
      latestWaterTemp: latest ? latest.waterTemp : null,
      latestLogAt: latest ? latest.loggedAt : null,
      role: isSysOwner ? "owner" : (membership ? membership.role : "member"),
      logCount: logs.length,
      photoCount: photos.length
    };
  });
  
  res.json(results);
});

app.get("/api/plants/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const currentDb = await readDB();
  
  const plant = currentDb.plants.find(p => p.id === id);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }

  const sys = currentDb.systems.find(s => s.id === plant.systemId);
  const isSysOwner = sys && sys.userId === user.id;

  // Authorization check: User must be owner OR joint systemMember of the plant's system OR plant creator
  const isMember = currentDb.systemMembers.some(sm => sm.systemId === plant.systemId && sm.userId === user.id);
  
  if (plant.userId !== user.id && !isMember && !isSysOwner) {
    return res.status(403).json({ error: "No permission to view this plant" });
  }
  
  // Hydrate detailed logs, photos, nutrient records, schedule proposals, messages
  const logs = currentDb.growLogs
    .filter(gl => gl.plantId === id)
    .map(l => {
      const poster = currentDb.users.find(u => u.id === l.postedBy);
      return { ...l, postedByName: poster ? poster.name : "不明なユーザー" };
    })
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    
  const photos = currentDb.plantPhotos
    .filter(ph => ph.plantId === id)
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
    
  const nutrients = logs
    .filter(gl => gl.appliedFertilizer)
    .map(l => {
      return {
        id: "fg-" + l.id,
        plantId: l.plantId,
        postedBy: l.postedBy,
        postedByName: l.postedByName,
        brand: l.fertilizerBrand || "一般肥料",
        dilutionRate: l.fertilizerDilutionRate || 1, // 1 means solid or direct input
        amountMl: l.fertilizerAmountMl || 0,
        note: l.note,
        appliedAt: l.loggedAt
      };
    });
    
  const proposals = currentDb.scheduleProposals
    .filter(sp => sp.plantId === id)
    .sort((a, b) => new Date(a.proposedDate).getTime() - new Date(b.proposedDate).getTime());
    
  const chatMessages = currentDb.chatMessages
    .filter(cm => cm.plantId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
  // Get owner details
  const ownerUser = currentDb.users.find(usr => usr.id === sys?.userId);
  const ownerMemberArray = ownerUser ? [{
    userId: ownerUser.id,
    name: ownerUser.name,
    email: ownerUser.email,
    role: "owner",
    joinedAt: sys?.createdAt || new Date().toISOString()
  }] : [];

  // Get members of this planter (system), filtering out the owner to prevent duplication
  const otherMembers = currentDb.systemMembers
    .filter(sm => sm.systemId === plant.systemId && sm.userId !== sys?.userId)
    .map(m => {
      const u = currentDb.users.find(usr => usr.id === m.userId);
      return {
        userId: m.userId,
        name: u ? u.name : "ゲスト栽培員",
        email: u ? u.email : "",
        role: m.role,
        joinedAt: m.joinedAt
      };
    });
    
  const members = [...ownerMemberArray, ...otherMembers];
  
  const isOwner = sys?.userId === user.id;
  const dbRole = currentDb.systemMembers.find(sm => sm.systemId === plant.systemId && sm.userId === user.id)?.role;
  const currentUserRole = isOwner ? "owner" : (dbRole || "member");
  
  res.json({
    ...plant,
    system: sys ? { name: sys.name, type: sys.type, description: sys.description } : null,
    growLogs: logs,
    plantPhotos: photos,
    nutrientLogs: nutrients,
    proposals,
    chatMessages,
    members,
    currentUserRole
  });
});

app.post("/api/plants", async (req, res) => {
  const user = await getUserContext(req);
  const { systemId, name, variety, stage, sowingDate, expectedHarvestDate, fertilizerBrand, fertilizerAmountMl, fertilizerDilutionRate } = req.body;
  if (!systemId || !name) {
    return res.status(400).json({ error: "systemId and Name are required" });
  }
  
  const currentDb = await readDB();
  const sysExists = currentDb.systems.some(s => s.id === systemId);
  if (!sysExists) {
    return res.status(400).json({ error: "プランターが見つかりません" });
  }
  
  const newPlant: Plant = {
    id: "plant-" + Date.now(),
    systemId,
    userId: user.id, // Owner
    name,
    variety: variety || "通常品種",
    stage: stage || "vegetative",
    sowingDate: sowingDate || new Date().toISOString().split("T")[0],
    expectedHarvestDate: expectedHarvestDate || new Date(Date.now() + 30 * 24 * 3600_000).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fertilizerBrand: fertilizerBrand || undefined,
    fertilizerAmountMl: fertilizerAmountMl !== "" && fertilizerAmountMl !== undefined ? parseFloat(fertilizerAmountMl) : undefined,
    fertilizerDilutionRate: fertilizerDilutionRate !== "" && fertilizerDilutionRate !== undefined ? parseInt(fertilizerDilutionRate, 10) : undefined
  };
  
  currentDb.plants.push(newPlant);
  await writeDB(currentDb);
  res.status(201).json(newPlant);
});

app.put("/api/plants/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { name, variety, stage, sowingDate, expectedHarvestDate, systemId, archived, fertilizerBrand, fertilizerAmountMl, fertilizerDilutionRate } = req.body;
  
  const currentDb = await readDB();
  const idx = currentDb.plants.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  // Permission validator (only owner can edit metadata details of system plants)
  if (currentDb.plants[idx].userId !== user.id) {
    return res.status(403).json({ error: "オーナーしか設定変更できません" });
  }
  
  if (name) currentDb.plants[idx].name = name;
  if (variety) currentDb.plants[idx].variety = variety;
  if (stage) currentDb.plants[idx].stage = stage;
  if (sowingDate) currentDb.plants[idx].sowingDate = sowingDate;
  if (expectedHarvestDate) currentDb.plants[idx].expectedHarvestDate = expectedHarvestDate;
  if (systemId) currentDb.plants[idx].systemId = systemId;
  if (archived !== undefined) currentDb.plants[idx].archived = Boolean(archived);
  
  // Always update if provided or explicitly set (even to null/empty values for resetting template)
  if (fertilizerBrand !== undefined) currentDb.plants[idx].fertilizerBrand = fertilizerBrand || undefined;
  if (fertilizerAmountMl !== undefined) currentDb.plants[idx].fertilizerAmountMl = (fertilizerAmountMl !== "" && fertilizerAmountMl !== null) ? parseFloat(fertilizerAmountMl) : undefined;
  if (fertilizerDilutionRate !== undefined) currentDb.plants[idx].fertilizerDilutionRate = (fertilizerDilutionRate !== "" && fertilizerDilutionRate !== null) ? parseInt(fertilizerDilutionRate, 10) : undefined;

  currentDb.plants[idx].updatedAt = new Date().toISOString();
  
  await writeDB(currentDb);
  res.json(currentDb.plants[idx]);
});

app.delete("/api/plants/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  
  const currentDb = await readDB();
  const plantIdx = currentDb.plants.findIndex(p => p.id === id);
  if (plantIdx === -1) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  if (currentDb.plants[plantIdx].userId !== user.id) {
    return res.status(403).json({ error: "植物のオーナーしか削除できません" });
  }
  
  // Perform Cascade Deletes manually to simulate SQL constraint cleanly
  currentDb.plants.splice(plantIdx, 1);
  currentDb.growLogs = currentDb.growLogs.filter(gl => gl.plantId !== id);
  currentDb.nutrientLogs = currentDb.nutrientLogs.filter(nl => nl.plantId !== id);
  currentDb.plantPhotos = currentDb.plantPhotos.filter(ph => ph.plantId !== id);
  currentDb.scheduleProposals = currentDb.scheduleProposals.filter(sp => sp.plantId !== id);
  currentDb.chatMessages = currentDb.chatMessages.filter(cm => cm.plantId !== id);
  
  await writeDB(currentDb);
  res.json({ success: true });
});

// Invite member to joint cultivate list (Planter/System level)
app.post("/api/systems/:id/members", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = await readDB();
  const system = currentDb.systems.find(s => s.id === id);
  if (!system) {
    return res.status(404).json({ error: "Planter not found" });
  }
  
  // Must be owner or existing member of this planter to invite
  const requesterIsMember = currentDb.systemMembers.some(sm => sm.systemId === id && sm.userId === user.id);
  if (system.userId !== user.id && !requesterIsMember) {
    return res.status(403).json({ error: "共同栽培員の招待権限がありません" });
  }
  
  // Find or register target user on invitation fly
  let targetUser = currentDb.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!targetUser) {
    const parts = email.split("@");
    targetUser = {
      id: "user-" + Date.now(),
      email: email.trim().toLowerCase(),
      name: parts[0] || "栽培仲間",
      createdAt: new Date().toISOString()
    };
    currentDb.users.push(targetUser);
  }
  
  // Check if already is member of this planter
  const alreadyMember = currentDb.systemMembers.some(sm => sm.systemId === id && sm.userId === targetUser!.id);
  if (alreadyMember) {
    return res.status(400).json({ error: "このユーザーは既に共同栽培を行っています" });
  }
  
  const newMember: SystemMember = {
    id: "m-" + Date.now(),
    systemId: id,
    userId: targetUser.id,
    role: "member",
    joinedAt: new Date().toISOString()
  };
  
  currentDb.systemMembers.push(newMember);
  await writeDB(currentDb);
  res.json({ success: true, memberUser: targetUser });
});

// Backward compatibility helper for plant level invitation (delegates to system/planter level)
app.post("/api/plants/:id/members", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === id);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  // Delegate invitation to system
  const system = currentDb.systems.find(s => s.id === plant.systemId);
  if (!system) {
    return res.status(404).json({ error: "Associated planter not found" });
  }
  
  const requesterIsMember = currentDb.systemMembers.some(sm => sm.systemId === system.id && sm.userId === user.id);
  if (system.userId !== user.id && !requesterIsMember) {
    return res.status(403).json({ error: "共同栽培員の招待権限がありません" });
  }
  
  let targetUser = currentDb.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!targetUser) {
    const parts = email.split("@");
    targetUser = {
      id: "user-" + Date.now(),
      email: email.trim().toLowerCase(),
      name: parts[0] || "栽培仲間",
      createdAt: new Date().toISOString()
    };
    currentDb.users.push(targetUser);
  }
  
  const alreadyMember = currentDb.systemMembers.some(sm => sm.systemId === system.id && sm.userId === targetUser!.id);
  if (alreadyMember) {
    return res.status(400).json({ error: "このユーザーは既に共同栽培を行っています" });
  }
  
  const newMember: SystemMember = {
    id: "m-" + Date.now(),
    systemId: system.id,
    userId: targetUser.id,
    role: "member",
    joinedAt: new Date().toISOString()
  };
  
  currentDb.systemMembers.push(newMember);
  await writeDB(currentDb);
  res.json({ success: true, memberUser: targetUser });
});

// Evict or leave planter group
app.delete("/api/systems/:id/members/:userId", async (req, res) => {
  const user = await getUserContext(req);
  const { id, userId } = req.params;
  
  const currentDb = await readDB();
  const system = currentDb.systems.find(s => s.id === id);
  if (!system) {
    return res.status(404).json({ error: "Planter not found" });
  }
  
  // Only owner can kick, but anyone can leave by themselves
  if (system.userId !== user.id && user.id !== userId) {
    return res.status(403).json({ error: "メンバー退出・解任操作を行う権限がありません" });
  }
  
  if (system.userId === userId) {
    return res.status(400).json({ error: "オーナーは退出できません。プランター環境そのものを削除してください。" });
  }
  
  const idx = currentDb.systemMembers.findIndex(sm => sm.systemId === id && sm.userId === userId);
  if (idx !== -1) {
    currentDb.systemMembers.splice(idx, 1);
    await writeDB(currentDb);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: "Member not found" });
});


// プランター単体での共同栽培メンバーの招待
app.post("/api/systems/:id/members", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params; // system id
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "メールアドレスを入力してください" });
  }

  const currentDb = await readDB();
  const system = currentDb.systems.find(s => s.id === id);
  if (!system) {
    return res.status(404).json({ error: "プランターが見つかりません" });
  }

  const isOwner = system.userId === user.id;
  const isMember = currentDb.systemMembers.some(sm => sm.systemId === id && sm.userId === user.id);
  if (!isOwner && !isMember) {
    return res.status(403).json({ error: "このプランターに招待する権限がありません" });
  }

  const targetUser = currentDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!targetUser) {
    return res.status(404).json({ error: "登録されていないユーザーです。相手がこのアプリに一度ログインしている必要があります。" });
  }

  if (targetUser.id === system.userId) {
    return res.status(400).json({ error: "代表オーナー自身を追加することはできません" });
  }

  const alreadyMember = currentDb.systemMembers.some(sm => sm.systemId === id && sm.userId === targetUser.id);
  if (alreadyMember) {
    return res.status(400).json({ error: "このユーザーは既に共同栽培メンバーです" });
  }

  const newMember = {
    id: "sm-" + Date.now() + Math.random().toString(36).substr(2, 5),
    systemId: id,
    userId: targetUser.id,
    role: "member" as const,
    joinedAt: new Date().toISOString()
  };

  currentDb.systemMembers.push(newMember);
  await writeDB(currentDb);

  res.json({ success: true, member: { userId: targetUser.id, name: targetUser.name, email: targetUser.email, role: "member" } });
});

// プランター単体での共同栽培メンバーの解任・辞退
app.delete("/api/systems/:id/members/:userId", async (req, res) => {
  const user = await getUserContext(req);
  const { id, userId } = req.params;

  const currentDb = await readDB();
  const system = currentDb.systems.find(s => s.id === id);
  if (!system) {
    return res.status(404).json({ error: "プランターが見つかりません" });
  }

  const isOwner = system.userId === user.id;
  const isMyself = userId === user.id;

  if (!isOwner && !isMyself) {
    return res.status(403).json({ error: "メンバー退出・解任操作を行う権限がありません" });
  }

  if (system.userId === userId) {
    return res.status(400).json({ error: "オーナーは退出できません。プランター環境そのものを削除してください。" });
  }

  const idx = currentDb.systemMembers.findIndex(sm => sm.systemId === id && sm.userId === userId);
  if (idx !== -1) {
    currentDb.systemMembers.splice(idx, 1);
    await writeDB(currentDb);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "栽培メンバーが見つかりません" });
});

// Backward compatibility helper for plant level eviction
app.delete("/api/plants/:id/members/:userId", async (req, res) => {
  const user = await getUserContext(req);
  const { id, userId } = req.params;
  
  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === id);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const system = currentDb.systems.find(s => s.id === plant.systemId);
  if (!system) {
    return res.status(404).json({ error: "Associated planter not found" });
  }
  
  if (system.userId !== user.id && user.id !== userId) {
    return res.status(403).json({ error: "メンバー退出・解任操作を行う権限がありません" });
  }
  
  if (system.userId === userId) {
    return res.status(400).json({ error: "オーナーは退出できません。" });
  }
  
  const idx = currentDb.systemMembers.findIndex(sm => sm.systemId === system.id && sm.userId === userId);
  if (idx !== -1) {
    currentDb.systemMembers.splice(idx, 1);
    await writeDB(currentDb);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: "Member not found" });
});


// 所有者の変更 (Transfer Ownership) for System
app.put("/api/systems/:id/transfer-owner", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { newOwnerUserId } = req.body;
  if (!newOwnerUserId) {
    return res.status(400).json({ error: "新しい代表者の指定が必要です" });
  }

  const currentDb = await readDB();
  const system = currentDb.systems.find(s => s.id === id);
  if (!system) {
    return res.status(404).json({ error: "プランターが見つかりません" });
  }

  if (system.userId !== user.id) {
    return res.status(403).json({ error: "代表者を変更できるのは現在のオーナーのみです" });
  }

  if (user.id === newOwnerUserId) {
    return res.status(400).json({ error: "自分自身に譲渡することはできません" });
  }

  const targetUser = currentDb.users.find(u => u.id === newOwnerUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "指定されたユーザーが見つかりません" });
  }

  system.userId = newOwnerUserId;
  system.updatedAt = new Date().toISOString();

  // Remove the new owner from shared systemMembers
  currentDb.systemMembers = currentDb.systemMembers.filter(sm => !(sm.systemId === id && sm.userId === newOwnerUserId));

  // Downgrade old owner to member
  const oldOwnerIsMember = currentDb.systemMembers.some(sm => sm.systemId === id && sm.userId === user.id);
  if (!oldOwnerIsMember) {
    currentDb.systemMembers.push({
      id: "m-" + Date.now(),
      systemId: id,
      userId: user.id,
      role: "member",
      joinedAt: new Date().toISOString()
    });
  }

  await writeDB(currentDb);
  res.json({ success: true, newOwner: targetUser });
});

// 所有者の変更 (Transfer Ownership) for Plant wrapper
app.put("/api/plants/:id/transfer-owner", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { newOwnerUserId } = req.body;
  if (!newOwnerUserId) {
    return res.status(400).json({ error: "新しい代表者の指定が必要です" });
  }

  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === id);
  if (!plant) {
    return res.status(404).json({ error: "植物が見つかりません" });
  }

  const system = currentDb.systems.find(s => s.id === plant.systemId);
  if (!system) {
    return res.status(404).json({ error: "プランターが見つかりません" });
  }

  if (system.userId !== user.id) {
    return res.status(403).json({ error: "代表者を変更できるのは現在のオーナーのみです" });
  }

  if (user.id === newOwnerUserId) {
    return res.status(400).json({ error: "自分自身に譲渡することはできません" });
  }

  const targetUser = currentDb.users.find(u => u.id === newOwnerUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "指定されたユーザーが見つかりません" });
  }

  system.userId = newOwnerUserId;
  system.updatedAt = new Date().toISOString();

  // Remove the new owner from shared systemMembers
  currentDb.systemMembers = currentDb.systemMembers.filter(sm => !(sm.systemId === system.id && sm.userId === newOwnerUserId));

  // Downgrade old owner to member
  const oldOwnerIsMember = currentDb.systemMembers.some(sm => sm.systemId === system.id && sm.userId === user.id);
  if (!oldOwnerIsMember) {
    currentDb.systemMembers.push({
      id: "m-" + Date.now(),
      systemId: system.id,
      userId: user.id,
      role: "member",
      joinedAt: new Date().toISOString()
    });
  }

  await writeDB(currentDb);
  res.json({ success: true, newOwner: targetUser });
});


// --- GROW LOGS ENDPOINTS ---
app.post("/api/grow-logs", async (req, res) => {
  const user = await getUserContext(req);
  const { plantId, ph, ec, waterTemp, note, loggedAt, watered, imageUrl, imageUrls, appliedFertilizer, fertilizerBrand, fertilizerAmountMl, fertilizerDilutionRate } = req.body;
  if (!plantId) {
    return res.status(400).json({ error: "plantId is required" });
  }
  
  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const newLog: GrowLog = {
    id: "log-" + Date.now(),
    plantId,
    postedBy: user.id,
    ph: ph !== "" && ph !== undefined && ph !== null ? parseFloat(ph) : null,
    ec: ec !== "" && ec !== undefined && ec !== null ? parseFloat(ec) : null,
    waterTemp: waterTemp !== "" && waterTemp !== undefined && waterTemp !== null ? parseFloat(waterTemp) : null,
    note: note || "",
    loggedAt: loggedAt || new Date().toISOString(),
    watered: watered !== undefined ? Boolean(watered) : true,
    imageUrl: imageUrl || undefined,
    imageUrls: imageUrls || undefined,
    appliedFertilizer: appliedFertilizer !== undefined ? Boolean(appliedFertilizer) : undefined,
    fertilizerBrand: fertilizerBrand || undefined,
    fertilizerAmountMl: fertilizerAmountMl !== "" && fertilizerAmountMl !== undefined && fertilizerAmountMl !== null ? parseFloat(fertilizerAmountMl) : undefined,
    fertilizerDilutionRate: fertilizerDilutionRate !== "" && fertilizerDilutionRate !== undefined && fertilizerDilutionRate !== null ? parseInt(fertilizerDilutionRate, 10) : undefined
  };
  
  currentDb.growLogs.push(newLog);
  await writeDB(currentDb);
  res.status(201).json({ ...newLog, postedByName: user.name });
});

app.put("/api/grow-logs/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { ph, ec, waterTemp, note, loggedAt, watered, imageUrl, imageUrls, appliedFertilizer, fertilizerBrand, fertilizerAmountMl, fertilizerDilutionRate } = req.body;

  const currentDb = await readDB();
  const idx = currentDb.growLogs.findIndex(l => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Grow log not found" });
  }

  const log = currentDb.growLogs[idx];
  const plant = currentDb.plants.find(p => p.id === log.plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }

  // Permission check: poster or plant owner
  if (log.postedBy !== user.id && plant.userId !== user.id) {
    return res.status(403).json({ error: "許可されていません" });
  }

  if (ph !== undefined) currentDb.growLogs[idx].ph = ph !== "" && ph !== null ? parseFloat(ph) : null;
  if (ec !== undefined) currentDb.growLogs[idx].ec = ec !== "" && ec !== null ? parseFloat(ec) : null;
  if (waterTemp !== undefined) currentDb.growLogs[idx].waterTemp = waterTemp !== "" && waterTemp !== null ? parseFloat(waterTemp) : null;
  if (note !== undefined) currentDb.growLogs[idx].note = note;
  if (loggedAt !== undefined) currentDb.growLogs[idx].loggedAt = loggedAt;
  if (watered !== undefined) currentDb.growLogs[idx].watered = Boolean(watered);
  if (imageUrl !== undefined) currentDb.growLogs[idx].imageUrl = imageUrl;
  if (imageUrls !== undefined) currentDb.growLogs[idx].imageUrls = imageUrls;
  
  if (appliedFertilizer !== undefined) currentDb.growLogs[idx].appliedFertilizer = Boolean(appliedFertilizer);
  if (fertilizerBrand !== undefined) currentDb.growLogs[idx].fertilizerBrand = fertilizerBrand;
  if (fertilizerAmountMl !== undefined) currentDb.growLogs[idx].fertilizerAmountMl = fertilizerAmountMl !== "" && fertilizerAmountMl !== null ? parseFloat(fertilizerAmountMl) : undefined;
  if (fertilizerDilutionRate !== undefined) currentDb.growLogs[idx].fertilizerDilutionRate = fertilizerDilutionRate !== "" && fertilizerDilutionRate !== null ? parseInt(fertilizerDilutionRate, 10) : undefined;

  await writeDB(currentDb);
  res.json(currentDb.growLogs[idx]);
});

app.get("/api/proposals", async (req, res) => {
  const user = await getUserContext(req);
  const currentDb = await readDB();

  const systemIdsAllowed = currentDb.systemMembers
    .filter(sm => sm.userId === user.id)
    .map(sm => sm.systemId);

  const systemIdsOwned = currentDb.systems
    .filter(s => s.userId === user.id)
    .map(s => s.id);
    
  const allowedPlantIds = currentDb.plants
    .filter(p => 
      p.userId === user.id || 
      systemIdsOwned.includes(p.systemId) || 
      systemIdsAllowed.includes(p.systemId)
    )
    .map(p => p.id);

  const proposals = currentDb.scheduleProposals.filter(sp => 
    allowedPlantIds.includes(sp.plantId) || sp.userId === user.id
  );

  res.json(proposals);
});

app.post("/api/proposals", async (req, res) => {
  const user = await getUserContext(req);
  const { plantId, type, proposedDate, note } = req.body;
  
  if (!plantId || !type || !proposedDate) {
    return res.status(400).json({ error: "plantId, type, and proposedDate are required" });
  }

  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }

  const newProposal: ScheduleProposal = {
    id: "prop-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    plantId,
    userId: user.id,
    type,
    proposedDate,
    note: note || "",
    status: "approved", // Manually created ones are set to active/approved directly
    createdAt: new Date().toISOString()
  };

  currentDb.scheduleProposals.push(newProposal);
  await writeDB(currentDb);
  res.status(211).json(newProposal);
});

app.put("/api/proposals/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { status, proposedDate, type, note } = req.body;
  
  const currentDb = await readDB();
  const idx = currentDb.scheduleProposals.findIndex(sp => sp.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  
  if (status) currentDb.scheduleProposals[idx].status = status;
  if (proposedDate) currentDb.scheduleProposals[idx].proposedDate = proposedDate;
  if (type) currentDb.scheduleProposals[idx].type = type;
  if (note !== undefined) currentDb.scheduleProposals[idx].note = note;
  
  await writeDB(currentDb);
  res.json(currentDb.scheduleProposals[idx]);
});

app.put("/api/schedule-proposals/:id", async (req, res) => {
  const user = await getUserContext(req);
  const { id } = req.params;
  const { status, proposedDate, type, note } = req.body; // approved / dismissed / pending
  
  const currentDb = await readDB();
  const idx = currentDb.scheduleProposals.findIndex(sp => sp.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  
  if (status) currentDb.scheduleProposals[idx].status = status;
  if (proposedDate) currentDb.scheduleProposals[idx].proposedDate = proposedDate;
  if (type) currentDb.scheduleProposals[idx].type = type;
  if (note !== undefined) currentDb.scheduleProposals[idx].note = note;
  
  await writeDB(currentDb);
  res.json(currentDb.scheduleProposals[idx]);
});


// --- AI INTERACT ADVICE ENDPOINT (Using Gemini + Google Search Grounding for micro-climate analysis) ---
app.post("/api/ai/chat", async (req, res) => {
  const user = await getUserContext(req);
  const { plantId, message, userLocation } = req.body;
  
  if (!plantId || !message) {
    return res.status(400).json({ error: "Plant ID and message content are required" });
  }
  
  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const sys = currentDb.systems.find(s => s.id === plant.systemId);
  const recentLogs = currentDb.growLogs
    .filter(l => l.plantId === plantId)
    .sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, 5);
    
  const recentFertilizers = currentDb.nutrientLogs
    .filter(n => n.plantId === plantId)
    .sort((a,b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 3);
    
  const logSummary = recentLogs.map(l => 
    `測定日時: ${l.loggedAt.split("T")[0]}、pH: ${l.ph ?? "未設定"}、EC: ${l.ec ?? "未設定"}、水温: ${l.waterTemp ?? "未設定"}℃、ノート: ${l.note}`
  ).join("\n");
  
  const fertSummary = recentFertilizers.map(f =>
    `施肥日: ${f.appliedAt.split("T")[0]}、液肥ブランド: ${f.brand}、希釈倍率: ${f.dilutionRate}倍、添加量: ${f.amountMl}ml`
  ).join("\n");
  
  const currentSysPrompt = `
あなたは世界で最も豊富な経験と植物生理学の知識を持つ「スマート栽培ディレクター（家庭菜園・ベランダプランター栽培・水耕栽培の総合指導員AI）」です。
現在、ユーザーは水耕用の特殊なプランターだけでなく、土を使った通常のプランターなど、様々なタイプのプランターで植物を栽培しています。

【植物のプロフィール】
- 植物名: ${plant.name}
- 品種: ${plant.variety}
- 育成ステージ: ${plant.stage} (苗期: seedling, 栄養成長期: vegetative, 開花期: flowering, 収穫期: harvest, 栽培終了: finished)
- 播種日(種まき): ${plant.sowingDate}
- 予想収穫日: ${plant.expectedHarvestDate}
- 栽培環境・プランター: ${sys ? sys.name : "その他"} (形式: ${sys ? sys.type : "Other"})
- 地域・気候パラメーター: ${userLocation || "未設定 (特に長野など寒暖差の大きい地域、日本の微細気候に対応)"}

【最近5回分の観察・記録ログ】
${logSummary || "（まだログはありません。弱酸性のpH 5.8~6.5、EC 1.0~2.5程度。土を使った通常のプランターなら、土の乾き具合、病害虫、日当たりなどの詳細な観察が記録されます）"}

【直近3回分の施肥・栄養記録】
${fertSummary || "（まだ肥料の添加記録はありません）"}

【アドバイス方針】
1. プランター種別が水耕の場合：日本の定番液肥「ハイポニカ」「OATハウス」「微粉ハイポネックス」などの配合設計や、pH / EC / 水温・根腐れの的確なアドバイスを行います。
2. プランター種別が土耕用プランターの場合：水やり頻度（土が乾いたらたっぷり鉢底から流れるまで）、プランター特有の熱対策・底面潅水、追肥（マグァンプKやマイガーデン等の固形化成肥料や液体肥料の土壌散布）、芽かき（わき芽かき）、摘心、土寄せ、マルチング等、それぞれの特性に基づいた実直で丁寧なアドバイスをします。
3. ユーザーが指定した地域（${userLocation || "日本"}）の現在の季節要因（寒冷期の地温、梅雨期の過湿、夏の日射・水温急上昇など）を十分に考慮します。
4. なぜ葉が黄色くなるのか、成長が遅いのか、病害虫の疑いはないか、植物生理学に基づきつつも初心者へ分かりやすく丁寧に説明してください。
5. 回答は過剰な装飾をせず、親身でスマートなマークダウン形式の日本語で回答します。`;

  // Append user's requested chat history if saved
  const chatMessagesHistory = currentDb.chatMessages
    .filter(cm => cm.plantId === plantId)
    .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-10); // Keep last 10 turns back

  // Append user new message as well to local DB
  const userMsg: ChatMessage = {
    id: "cm-user-" + Date.now(),
    plantId,
    postedBy: user.id,
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  };
  currentDb.chatMessages.push(userMsg);
  
  let assistantText = "";
  
  if (geminiClient) {
    try {
      // Setup chat historical input array according to @google/genai format
      const chatParts: any[] = chatMessagesHistory.map(m => {
        return {
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        };
      });
      
      // Query Google Gemini 3.5 with Search Grounding
      const contentsPayload = [
        ...chatParts,
        { role: "user", parts: [{ text: `【ユーザーの質問】\n${message}` }] }
      ];
      
      const aiResponse = await geminiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction: currentSysPrompt,
          // Support regional weather grounding dynamically!
          tools: [{ googleSearch: {} }]
        }
      });
      
      assistantText = aiResponse.text || "申し訳ありません。AIからの返答を生成できませんでした。";
      
    } catch (aiError: any) {
      const errMsg = aiError?.message || String(aiError);
      console.warn("Gemini Content Generation Warning:", errMsg);
      let errorAlert = "";
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Quota") || errMsg.includes("limit")) {
        errorAlert = "【⚠️ Gemini API利用枠上限超過 (429 Quota Exceeded)】現在リクエスト枠を超過しているため、内蔵のローカル園芸知識AI判定エンジンによりアドバイスを提供いたします。\n\n";
      } else {
        errorAlert = "【⚠️ Gemini API通信エラー (オフラインバックアップ)】現在一時的に接続が休止されているため、内蔵 of ローカル園芸知識AI判定エンジンによりアドバイスを提供いたします。\n\n";
      }
      const isSoil = sys && isSoilSystem(sys.type);
      if (isSoil) {
        assistantText = `${errorAlert}【お世話のアドバイス（土耕・プランター）】🌱
- 土耕・プランター栽培では、土の乾湿リズム（乾いたらたっぷり潅水）を意識してください。
- 脇芽かき（pruning）や摘心をすることで、風通しを高め病害虫を予防できます。
- 日当たりの確保や、施肥の間隔に注意しましょう。`;
      } else {
        assistantText = `${errorAlert}【お世話のアドバイス（水耕栽培）】💧
- pHが${recentLogs[0]?.ph || "記録なし"}と表示されていますが、通常は 5.8〜6.5 が適正域です。
- 液肥の2段階希釈やお水の水換え時期を考慮に入れ、根腐れを予防しましょう。`;
      }
    }
  } else {
    // Elegant Simulated fallback advice if API key skipped
    const isSoil = sys && isSoilSystem(sys.type);
    if (isSoil) {
      assistantText = `【解説シミュレーター】現在ローカルのAI診断エンジンで応答しています。
お育ての ${plant.name} (品種: ${plant.variety}, ステージ: ${plant.stage}) の状態をお庭・プランターに合わせて分析しました。
- 散水：土の表面が白っぽく乾燥したら、鉢底からたっぷり水が流れ出るまで潅水するのが基本です。夏場のベランダでは、夕方や早朝の涼しい時間が最適です。
- 栄養・追肥：成長期（${plant.stage}）に合わせて、野菜用の固形IB化成肥料、または「マイガーデン」などの固形肥料を土に追肥し、中耕・土寄せを行ってください。
- 剪定・管理：日当たり、通風、および湿度管理が重要です。不要なわき芽は早めに手で摘み取り、黄色く枯れた下葉は風通しの確保と病気対策としてすべて除去してください。
- ${userLocation ? `${userLocation}の気候パラメータを考慮中` : "地域設定（長野等）を設定すると冬や夏の気象・寒暖差情報を考慮します"}。`;
    } else {
      assistantText = `【解説シミュレーター】現在ローカルのAI診断エンジンで応答しています。
お育ての ${plant.name} (品種: ${plant.variety}, ステージ: ${plant.stage}) の状態を分析しました。
- 水耕栽培用の代表液肥「ハイポニカ」は500倍希釈 (水1Lに対してA液2ml、B液2ml) が最適です。
- 現在の育成ステージは "${plant.stage}" です。植物の葉の色が黄色くなっている場合、EC値の低下による窒素欠乏、または水温が25℃を超えたことによる酸素欠乏（根腐れ）が疑われます。
- ${userLocation ? `${userLocation}の気候パラメータを考慮中` : "地域設定（長野等）を設定すると冬や夏の温度管理を自動考慮します"}。まずは根の色が茶色く変色していないか確認してください。`;
    }
  }
  
  // Record Assistant Msg also in Database
  const assistantMsg: ChatMessage = {
    id: "cm-assistant-" + Date.now(),
    plantId,
    postedBy: "assistant",
    role: "assistant",
    content: assistantText,
    createdAt: new Date().toISOString()
  };
  currentDb.chatMessages.push(assistantMsg);
  
  await writeDB(currentDb);
  res.json({ response: assistantText, messages: [userMsg, assistantMsg] });
});


// --- AI CALENDAR PROPOSAL AUTOMATIC GENERATOR ---
app.post("/api/ai/propose-schedule", async (req, res) => {
  const user = await getUserContext(req);
  const { plantId, userLocation } = req.body;
  if (!plantId) {
    return res.status(400).json({ error: "Plant ID is required to synthesize schedules" });
  }
  
  const currentDb = await readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const sys = currentDb.systems.find(s => s.id === plant.systemId);
  const userRecord = currentDb.users.find(u => u.id === user.id);
  const showPhEc = userRecord ? (userRecord.showPhEc !== false) : true;
  
  const prompt = `
あなたは「家庭菜園・プランター・スマート栽培の専門AIアドバイザー」です。対象の植物とプランター栽培環境（土耕プランターか水耕かなど）を分析し、**栽培スケジュールカレンダーのイベント案をJSON形式で2〜3件**作成してください。
必ず、以下のJSON配列形式のみを出力してください。余計なマークダウンのバッククォーツ（\`\`\`json など）や文章は一切含めず、プレーンテキストとしてJSONオブジェクトを返してください。

[
  {
    "type": "nutrient" | "water_change" | "harvest" ${showPhEc ? '| "ph_check"' : '| "watering"'},
    "proposedDate": "YYYY-MM-DD",
    "note": "カレンダー記載用の詳細な解説"
  }
]

【カレンダー提案ルール】
- 施肥(\`nutrient\`): 液肥「ハイポニカ」500倍、「OATハウス」1000倍など日本の定番肥料に合わせた希釈案内、または土耕用IB化成肥料の追肥。
- 全水換え(\`water_change\`): 水耕栽培における、根腐れや藻の発生を防ぐための栽培水の総交換リフレッシュ案。
${showPhEc ? "- 測定・確認(`ph_check`): pH値が酸性・アルカリ性に傾いていないかのチェック推奨。" : "- 水やり(`watering`): プランターや培地の乾燥具合に合わせた適正な散水推奨。"}
- 収穫(\`harvest\`): 品種や播種日から想定される推奨収穫タイミング。

【※重要制約】
${showPhEc ? "" : "- 現在pHやEC測定の高度な水質測定管理が無効化されているため、絶対に `ph_check` タイプの提案は含めないで、代わりに `watering` や `nutrient` もしくは `harvest` などを提案してください。"}

【分析する植物データ】
- 植物名: ${plant.name}
- 品種: ${plant.variety}
- 現在の育成ステージ: ${plant.stage}
- 種まき日: ${plant.sowingDate}
- 予想収穫日: ${plant.expectedHarvestDate}
- プランター・環境タイプ: ${sys ? sys.type : "Hydro_Water"}
- 地域気候情報: ${userLocation || "長野県（日本の典型的な気候）"}
- 計算の基準日(本日): ${new Date().toISOString().split("T")[0]}
`;

  let proposalsSeed: any[] = [];
  
  if (geminiClient) {
    try {
      const response = await geminiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const cleanText = (response.text || "").trim();
      proposalsSeed = JSON.parse(cleanText);
    } catch (apiErr: any) {
      console.warn("Failed to generate propose schedules with Gemini. Using high-precision local fallback computation:", apiErr?.message || apiErr);
      proposalsSeed = generateFallbackProposals(plant, sys, userLocation, showPhEc);
    }
  } else {
    proposalsSeed = generateFallbackProposals(plant, sys, userLocation, showPhEc);
  }
  
  // Extra safety filter to strip ph_check if toggled off
  if (!showPhEc) {
    proposalsSeed = proposalsSeed.filter(p => p.type !== "ph_check");
  }
  
  // Convert returned entries into database schedule proposals
  const newProposals: ScheduleProposal[] = proposalsSeed.map((p, idx) => {
    return {
      id: `prop-ai-${Date.now()}-${idx}`,
      plantId,
      userId: user.id,
      type: p.type,
      proposedDate: p.proposedDate || new Date(Date.now() + (idx + 1) * 3 * 24 * 3600_000).toISOString().split("T")[0],
      note: p.note || "AI推奨タスク",
      status: "approved",
      createdAt: new Date().toISOString()
    };
  });
  
  // Save newly parsed proposals to Database
  currentDb.scheduleProposals.push(...newProposals);
  await writeDB(currentDb);
  
  res.json({ success: true, proposals: newProposals });
});

// Fallback algorithm computation for proposals
function generateFallbackProposals(plant: Plant, sys: any, location: string, showPhEc = true): any[] {
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 3600_000).toISOString().split("T")[0];
  const region = location || "長野などの寒暖差エリア";
  
  const isSoil = sys && isSoilSystem(sys.type);
  
  if (isSoil) {
    return [
      {
        type: "watering",
        proposedDate: tomorrow,
        note: `【AI推奨・潅水】${region}の気象下では土壌表面の乾湿リズム管理が最優先です。表面の土が乾いてから、鉢底や地中深くまで水が浸透するようたっぷり水やりしてください。`
      },
      {
        type: "pruning",
        proposedDate: nextWeek,
        note: `【AI推奨・芽かき】成長ステージ「${plant.stage}」を考慮し、主枝の日当たりを最大化するため脇芽や不要な下葉をカット（剪定・芽かき）してください。`
      }
    ];
  }
  
  if (!showPhEc) {
    return [
      {
        type: "watering",
        proposedDate: tomorrow,
        note: `【AI推奨・潅水】${region}の気象条件に合わせ、適切な水分供給サイクルを維持します。培地や根元に十分水分がいき渡るよう管理しましょう。`
      },
      {
        type: "nutrient",
        proposedDate: nextWeek,
        note: `【液肥配合プラン】${plant.name}の成長期にあわせて液肥補給を推奨します。ハイポニカ液体肥料を500倍希釈 (水2Lに希釈液各A剤・B剤を4mlずつ) にて水槽を満たしてください。`
      }
    ];
  }
  
  return [
    {
      type: "ph_check",
      proposedDate: tomorrow,
      note: `【AI推奨】${region}の気候下では、植物の急激な吸水によりpH変動が早まる恐れがあります。pHを5.8〜6.2にキープするため、試験紙またはメーターによる健康測定を推奨します。`
    },
    {
      type: "nutrient",
      proposedDate: nextWeek,
      note: `【液肥配合プラン】${plant.name}の成長期にあわせて液肥補給を推奨します。ハイポニカ液体肥料を500倍希釈 (水2Lに希釈液各A剤・B剤を4mlずつ) にて水槽を満たしてください。`
    }
  ];
}


// --- ICAL (.ics) CALENDAR EXPORT GENERATOR ---
app.get("/api/calendar/export", async (req, res) => {
  const user = await getUserContext(req);
  const currentDb = await readDB();
  
  // Hydrate only approved proposals
  const userSystemIds = currentDb.systems.filter(s => s.userId === user.id).map(s => s.id);
  const jointSystemIds = currentDb.systemMembers.filter(sm => sm.userId === user.id).map(sm => sm.systemId);
  const allowedSystemIds = Array.from(new Set([...userSystemIds, ...jointSystemIds]));
  
  const allowedPlantIds = currentDb.plants.filter(p => allowedSystemIds.includes(p.systemId)).map(p => p.id);
    
  const approvedProposals = currentDb.scheduleProposals.filter(
    sp => allowedPlantIds.includes(sp.plantId) && sp.status === "approved"
  );
  
  // Construct dynamic iCal format according to calendar guidelines
  let icsData = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Smart Garden System//Custom Calendar//JA\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
  
  approvedProposals.forEach(p => {
    const targetPlant = currentDb.plants.find(plant => plant.id === p.plantId);
    const plantName = targetPlant ? targetPlant.name : "栽培中の植物";
    
    // Convert YYYY-MM-DD date to YYYYMMDD iCal format
    const cleanDate = p.proposedDate.replace(/-/g, "");
    
    // Set Japanese human translation for event headers
    let title = "";
    switch(p.type) {
      case "watering": title = `💧 [水やり] ${plantName} の潅水タイミング`; break;
      case "nutrient": title = `🧪 [追肥施肥] ${plantName} の肥料・栄養補給`; break;
      case "pruning": title = `✂️ [整枝芽摘] ${plantName} の脇芽かき・摘心整枝`; break;
      case "weeding_aeration": title = `🌾 [除草中耕] ${plantName} の除草・土寄せ・耕作`; break;
      case "water_change": title = `💧 [水換え] ${plantName} の液肥水槽リセット`; break;
      case "ph_check": title = `📊 [栽培測定] ${plantName} のpH / EC測定チェック`; break;
      case "harvest": title = `🎉 [収穫タイミング] ${plantName} の収穫期`; break;
      default: title = `🌱 [栽培タスク] ${plantName} の定時作業`;
    }
    
    icsData += "BEGIN:VEVENT\r\n";
    icsData += `UID:${p.id}@hydroponics.app\r\n`;
    icsData += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z\r\n`;
    icsData += `DTSTART;VALUE=DATE:${cleanDate}\r\n`;
    icsData += `DTEND;VALUE=DATE:${cleanDate}\r\n`;
    icsData += `SUMMARY:${title}\r\n`;
    icsData += `DESCRIPTION:${p.note.replace(/\r?\n/g, "\\n")}\r\n`;
    icsData += "END:VEVENT\r\n";
  });
  
  icsData += "END:VCALENDAR\r\n";
  
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=hydroponics_schedule.ics");
  res.send(icsData);
});


// Boot sequence
async function boot() {
  console.log("サーバーの起動シーケンスを開始します。");
  
  // Firestoreの初期疎通確認
  try {
    console.log("[Firestore] Verifying connection on startup...");
    await firestore.collection("metadata").doc("appState").get();
    console.log("[Firestore] Firestore connection verified successfully.");
  } catch (err) {
    console.error("[Firestore] ERROR: Failed to connect to Firestore on startup:", err);
  }
  
  const distPath = path.join(process.cwd(), "dist");

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(distPath));
    app.get("*", async (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production custom fullstack server running on port ${PORT}`);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Development custom fullstack server running on http://localhost:${PORT}`);
    });
  }
}

boot().catch(err => {
  console.error("Failed to boot hydroponics engine server:", err);
});
