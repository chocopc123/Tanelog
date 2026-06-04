import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

// High body limits for uploading base64 crop photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Database mock store path
const DB_PATH = path.join(process.cwd(), "db.json");

// System-wide Types
import { 
  User, System, SystemMember, Plant, GrowLog, PlantPhoto, 
  NutrientLog, ChatMessage, ScheduleProposal, HarvestPrediction 
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

// Initial Database Helper
function readDB(): DBStructure {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = createSeedData();
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const content = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(content);

    // Ensure all required fields exist
    parsed.users = parsed.users || [];
    parsed.systems = parsed.systems || [];
    parsed.plants = parsed.plants || [];

    // Check if systemMembers is missing or empty, and migrate if plantMembers exists
    if (!parsed.systemMembers || parsed.systemMembers.length === 0) {
      if (parsed.plantMembers && parsed.plantMembers.length > 0) {
        parsed.systemMembers = [];
        for (const pm of parsed.plantMembers) {
          const p = parsed.plants.find((x: any) => x.id === pm.plantId);
          if (p) {
            const exists = parsed.systemMembers.some((sm: any) => sm.systemId === p.systemId && sm.userId === pm.userId);
            if (!exists) {
              parsed.systemMembers.push({
                id: pm.id || ("sm-" + Date.now() + Math.random()),
                systemId: p.systemId,
                userId: pm.userId,
                role: pm.role || "member",
                joinedAt: pm.joinedAt || new Date().toISOString()
              });
            }
          }
        }
        // Write the migrated data back to db.json
        fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), "utf8");
      } else {
        parsed.systemMembers = [];
      }
    }

    parsed.growLogs = parsed.growLogs || [];
    parsed.plantPhotos = parsed.plantPhotos || [];
    parsed.nutrientLogs = parsed.nutrientLogs || [];
    parsed.chatMessages = parsed.chatMessages || [];
    parsed.scheduleProposals = parsed.scheduleProposals || [];
    parsed.weatherAdviceCache = parsed.weatherAdviceCache || {};
    parsed.harvestPredictions = parsed.harvestPredictions || [];
    parsed.lastHarvestCalculationAt = parsed.lastHarvestCalculationAt || "";

    return parsed;
  } catch (error) {
    console.error("Failed to read database, returning empty schemas:", error);
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
}

function writeDB(data: DBStructure) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}

// Generates beautiful realistic seeds in Japanese for instant rich display
function createSeedData(): DBStructure {
  const defaultUser: User = {
    id: "user-1",
    email: "choco.rgi.duck@gmail.com",
    name: "栽培マスター",
    createdAt: new Date().toISOString()
  };

  const coopUser: User = {
    id: "user-2",
    email: "friend@hydro.org",
    name: "緑川 葉子",
    createdAt: new Date().toISOString()
  };

  // Systems (Encompassing Hydro, Balcony Planters, Garden Fields)
  const sys1: System = {
    id: "sys-1",
    userId: "user-1",
    name: "リビングのDWC容器 (循環水耕プランター)",
    type: "DWC",
    description: "自作の深水循環コップ水耕セット。エアーポンプ付きの室内水耕プランター。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const sys2: System = {
    id: "sys-2",
    userId: "user-1",
    name: "ベランダの大型野菜プランター (土耕)",
    type: "Soil_Planter",
    description: "市販の野菜用培養土を入れた、水はけ穴付きのスリットプランター。日当たり良好。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const sys3: System = {
    id: "sys-3",
    userId: "user-1",
    name: "お庭の自家菜園スペース (露地畑)",
    type: "Backyard_Field",
    description: "土壌改良を施し、腐葉土と完熟堆肥を混ぜて作った本格的なお庭の小さな耕地。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Plants
  const plant1: Plant = {
    id: "plant-1",
    systemId: "sys-1",
    userId: "user-1",
    name: "サラダフリルレタス",
    variety: "プレミアムフリルレタス (室内水耕)",
    stage: "vegetative",
    sowingDate: "2026-05-10",
    expectedHarvestDate: "2026-06-15",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const plant2: Plant = {
    id: "plant-2",
    systemId: "sys-2",
    userId: "user-1",
    name: "ベランダ甘口ミニトマト",
    variety: "アイコ (プランター土耕)",
    stage: "flowering",
    sowingDate: "2026-04-15",
    expectedHarvestDate: "2026-07-15",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const plant3: Plant = {
    id: "plant-3",
    systemId: "sys-3",
    userId: "user-1",
    name: "お庭の採れたて大葉バジル",
    variety: "ジェノベーゼバジル (露地・地植え地)",
    stage: "vegetative",
    sowingDate: "2026-04-20",
    expectedHarvestDate: "2026-06-25",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Planter Collaboration members
  const member1: SystemMember = {
    id: "member-1",
    systemId: "sys-1",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member2: SystemMember = {
    id: "member-2",
    systemId: "sys-1",
    userId: "user-2",
    role: "member",
    joinedAt: new Date().toISOString()
  };

  const member3: SystemMember = {
    id: "member-3",
    systemId: "sys-2",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member4: SystemMember = {
    id: "member-4",
    systemId: "sys-3",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member5: SystemMember = {
    id: "member-5",
    systemId: "sys-3",
    userId: "user-2",
    role: "member",
    joinedAt: new Date().toISOString()
  };

  // Grow Logs (pH/EC is standard for hydro; empty/null or notes-focused for traditional gardening plots)
  const log1: GrowLog = {
    id: "log-1",
    plantId: "plant-1",
    postedBy: "user-1",
    ph: 6.2,
    ec: 1.4,
    waterTemp: 22.1,
    note: "水耕用の本葉がかなり広がってきました。液肥の減り具合が加速しています。",
    loggedAt: new Date(Date.now() - 48 * 3600_000).toISOString()
  };

  const log2: GrowLog = {
    id: "log-2",
    plantId: "plant-1",
    postedBy: "user-2",
    ph: 6.0,
    ec: 1.5,
    waterTemp: 21.8,
    note: "共同栽培で様子を見ました。微量にpHが下がったので、水を少し足して調整。",
    loggedAt: new Date(Date.now() - 12 * 3600_000).toISOString()
  };

  const log3: GrowLog = {
    id: "log-3",
    plantId: "plant-2",
    postedBy: "user-1",
    ph: null,
    ec: null,
    waterTemp: null,
    note: "プランター土壌での第一花房が開花しました！脇芽が何本か伸びてきたので芽かき（pruning）をして、夕方に土表面がよく乾いていたのでたっぷりとお水をあげました。",
    loggedAt: new Date(Date.now() - 24 * 3600_000).toISOString()
  };

  // Nutrient & Fertilizer Logs (Japanese fertilizer brands: Liquid water formulation OR Slow-release soil granules)
  const nLog1: NutrientLog = {
    id: "nlog-1",
    plantId: "plant-1",
    postedBy: "user-1",
    brand: "ハイポニカ液体肥料 (A液+B液)",
    dilutionRate: 500,
    amountMl: 4,
    note: "水耕の基準希釈500倍。水2Lに対してA液4ml、B液4mlを追加しました。",
    appliedAt: new Date(Date.now() - 5 * 24 * 3600_000).toISOString()
  };

  const nLog2: NutrientLog = {
    id: "nlog-2",
    plantId: "plant-2",
    postedBy: "user-1",
    brand: "マイガーデンベジフル (野菜用固形化成肥料)",
    dilutionRate: 1, // Traditional fertilizer is solid, not diluted
    amountMl: 15, // 15 grams or units
    note: "プランター内のミニトマト株元に、固形化成肥料15gを追肥し、周りの土と軽く混ぜ合わせました。",
    appliedAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString()
  };

  // Schedule Proposals for multiple types of fields: soil irrigation versus hydro pH
  const prop1: ScheduleProposal = {
    id: "prop-1",
    plantId: "plant-1",
    userId: "user-1",
    type: "nutrient",
    proposedDate: new Date(Date.now() + 24 * 3600_000).toISOString().split("T")[0],
    note: "サラダレタス用の追加水耕液肥（ハイポニカ 500倍希釈 1.5L）。前回の施肥から7日経過するため推奨します。",
    status: "approved",
    createdAt: new Date().toISOString()
  };

  const prop2: ScheduleProposal = {
    id: "prop-2",
    plantId: "plant-2",
    userId: "user-1",
    type: "watering",
    proposedDate: new Date(Date.now() + 2 * 24 * 3600_000).toISOString().split("T")[0],
    note: "【プランター水やり】ベランダは日中の密閉熱が激しいため、土の乾燥を確認し朝のうちにたっぷり底から流れ出るまで水やりしてください。",
    status: "approved",
    createdAt: new Date().toISOString()
  };

  const prop3: ScheduleProposal = {
    id: "prop-3",
    plantId: "plant-3",
    userId: "user-1",
    type: "pruning",
    proposedDate: new Date().toISOString().split("T")[0],
    note: "【脇芽摘み・摘心】バジルがよく分枝しています。先端の茎を摘心して、脇芽の成長および通風を促し、害虫予防を図ることをお勧めします。",
    status: "approved",
    createdAt: new Date().toISOString()
  };

  // Seed Photos
  const seedPhoto1: PlantPhoto = {
    id: "photo-1",
    plantId: "plant-1",
    growLogId: "log-1",
    postedBy: "user-1",
    storageKey: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23eefbf4'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%231b5e20'>🌱 レタスの葉の生育状況 (健康的な黄緑色)</text></svg>",
    caption: "室内水耕のレタス、新葉が瑞々しくフリル状に育っています！",
    takenAt: new Date(Date.now() - 48 * 3600_000).toISOString()
  };

  return {
    users: [defaultUser, coopUser],
    systems: [sys1, sys2, sys3],
    plants: [plant1, plant2, plant3],
    systemMembers: [member1, member2, member3, member4, member5],
    growLogs: [log1, log2, log3],
    plantPhotos: [seedPhoto1],
    nutrientLogs: [nLog1, nLog2],
    chatMessages: [],
    scheduleProposals: [prop1, prop2, prop3]
  };
}

// Ensure database file loaded / created
let db = readDB();

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    console.log("Gemini Client successfully initialized");
  } else {
    console.warn("GEMINI_API_KEY missing - AI Advisor features will run in intelligent simulation mode.");
  }
} catch (e) {
  console.error("Failed to initialize Google Gen AI wrapper:", e);
}

// Auth Middleware Helper (Frictionless custom session)
// Since this is an MVP single/multiple user web application we can pass user context in high-contrast headers or local state parameter
function getUserContext(req: any): User {
  const authHeader = req.headers["authorization"] || "";
  let userId = "user-1"; // Default
  if (authHeader.startsWith("Bearer ")) {
    userId = authHeader.substring(7);
  }
  const dbData = readDB();
  const found = dbData.users.find(u => u.id === userId || u.email === userId);
  if (found) return found;
  return dbData.users[0] || { id: "user-1", email: "choco.rgi.duck@gmail.com", name: "栽培マスター", createdAt: "" };
}

// APIs
// --- AUTH ENDPOINTS ---
app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = readDB();
  let user = currentDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    // Auto register as user focus friendlier UX
    const parts = email.split("@");
    user = {
      id: "user-" + Date.now(),
      email: email.toLowerCase(),
      name: parts[0] || "栽培仲間",
      createdAt: new Date().toISOString()
    };
    currentDb.users.push(user);
    writeDB(currentDb);
  }
  
  res.json({ user, token: user.id });
});

app.post("/api/auth/register", (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Email and Name are required" });
  }
  
  const currentDb = readDB();
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
  writeDB(currentDb);
  res.json({ user: newUser, token: newUser.id });
});

app.get("/api/auth/me", (req, res) => {
  const user = getUserContext(req);
  res.json({ user });
});

app.get("/api/weather-advice", async (req, res) => {
  const user = getUserContext(req);
  const location = (req.query.location as string || "長野県長野市").trim();
  
  const currentDb = readDB();
  if (!currentDb.weatherAdviceCache) {
    currentDb.weatherAdviceCache = {};
  }
  
  // JST time helper to calculate JST Date YYYY-MM-DD
  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
  
  const cacheKey = location;
  const cached = currentDb.weatherAdviceCache[cacheKey];
  
  if (cached && cached.date === todayJst) {
    return res.json({ advice: cached.content, date: cached.date, location });
  }
  
  let generatedAdvice = "";
  let geminiError: string | null = null;
  if (geminiClient) {
    try {
      const prompt = `「${location}」の本日および明日・今週の最新の天気予報、気温、降水量、気象警告などの情報を調査してください。
最高気温や最低気温を特定する際、必ず「摂氏（℃、Celsius）」として取得してください。

【超重要：華氏と摂氏の混同禁止・ダブルチェック強制】
海外や英語の気象情報サイトから情報を得る場合、華氏（°F、Fahrenheit）（例: 80°F（約26.7℃）や 70°F（約21.1℃））をそのまま「80℃台」「70℃」として出力してしまうバグが多発しています。日本国内において「80℃」などの摂氏気温は絶対にあり得ません（生命や植物が生存できません）。
もし華氏「80°F」などの情報だった場合は、必ず摂氏に換算（(F - 32) * 5/9）して「26℃〜27℃」または「20℃台後半」と正しく記述してください。日本の一般的な季節に応じた摂氏（目安として春〜秋なら15℃〜35℃程度）であることを絶対に確認してください。

園芸、家庭菜園、または温室・プランター栽培の観点で、明日またはこれからの気候に合わせた、栽培者向けの具体的で役立つお世話アドバイスや警告メッセージ（例：「明日は晴れて気温が20℃台後半まで上がる見込みです。日差しが強くなる時間帯もあるため、鉢植えの土の乾き具合をこまめにチェックし、水切れに注意しましょう」など）を2〜3文程度で簡潔に生成してください。

【出力ルール】
- 栽培や天気に関する絵文字「🌱」「☀️」「⚠️」「☔️」などを適宜交え、日本語で温かみのある表現にしてください。
- 余計な説明、前置き、導入部分（「検索の結果…」「気象によると…」など）や挨拶文は一切含めず、「そのままお知らせバナーに表示」できるようなアドバイス文（2〜3文）だけを出力してください。`;

      const aiResponse = await geminiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "あなたは親切なAI家庭菜園・園芸アドバイザーです。アクティブ地域における最新の実際の気象予報を検索し、明日の栽培のお世話に必要なアドバイスを具体的・明確・簡潔に提示します。特に気温は絶対に摂氏（℃）に変換し、華氏（°F）をそのまま摂氏（℃）として記述するバグを徹底的に防止してください。",
          tools: [{ googleSearch: {} }]
        }
      });
      
      generatedAdvice = aiResponse.text?.trim() || "";
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn("Weather advice Gemini call failed: using local fallback advice. Info:", errMsg);
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Quota") || errMsg.includes("limit")) {
        geminiError = "quota_exceeded";
      } else {
        geminiError = "api_error";
      }
    }
  }
  
  if (!generatedAdvice) {
    const month = new Date(Date.now() + 9 * 60 * 60 * 1000).getMonth() + 1;
    const fallbacks = [
      `本日の ${location} の気象傾向を考慮すると、現在の ${month} 月は湿度や風向きの変動が大きくなりやすい時期です。今後の気温低下による冷え込み、または過湿過多を防を防ぐため、プランターの土が十分に乾いていることを確認してから水やりを行いましょう。🌱`,
      `地域の最新気候に基づき、明日は予報温度が前後するおそれがあります。過剰な水分は根を傷める原因になりますので、明日一日の水やりは控えめにして、適宜風通しの良い環境で栽培を見守りましょう。⚠️`,
      `気候シミュレーションによると、本日の ${location} 周辺は安定期に入っています。明日の日照と気温変化を確認しながら、多湿を好まない植物は夕方の灌水を避け、朝にさらっと吸水させる程度のお世話が推奨されます。🍁`
    ];
    generatedAdvice = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  currentDb.weatherAdviceCache[cacheKey] = {
    date: todayJst,
    content: generatedAdvice
  };
  writeDB(currentDb);
  
  res.json({ advice: generatedAdvice, date: todayJst, location, geminiError });
});

app.get("/api/plants/harvest-predictions", async (req, res) => {
  const user = getUserContext(req);
  const force = req.query.force === "true";
  
  const currentDb = readDB();
  
  const now = new Date();
  const lastCalc = currentDb.lastHarvestCalculationAt ? new Date(currentDb.lastHarvestCalculationAt) : null;
  
  // Hours elapsed since last run, default to Infinity if no previous run
  const hoursSinceLastCalc = lastCalc ? (now.getTime() - lastCalc.getTime()) / (1000 * 60 * 60) : Infinity;
  // Automatically trigger if last calculation was more than 72 hours ago (approx twice a week), or if forced
  const shouldCalculate = hoursSinceLastCalc >= 72 || force;
  
  const activePlants = currentDb.plants.filter(p => p.userId === user.id && !p.archived && p.stage !== 'finished');

  let geminiError: string | null = null;

  if (shouldCalculate && activePlants.length > 0) {
    let aiPredictions: { plantId: string; calculatedHarvestDate: string; reason: string }[] = [];
    let usedAi = false;

    // Attempt prediction utilizing Gemini Client if available
    if (geminiClient && process.env.GEMINI_API_KEY) {
      try {
        const plantsPayload = activePlants.map(p => {
          const logs = currentDb.growLogs
            .filter(l => l.plantId === p.id)
            .sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
            .slice(0, 5)
            .map(l => ({
              loggedAt: l.loggedAt,
              ph: l.ph,
              ec: l.ec,
              waterTemp: l.waterTemp,
              note: l.note
            }));
          
          return {
            id: p.id,
            name: p.name,
            variety: p.variety,
            stage: p.stage,
            sowingDate: p.sowingDate,
            currentExpectedHarvestDate: p.expectedHarvestDate,
            recentLogs: logs
          };
        });

        const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
        const prompt = `あなたは優秀な水耕栽培、園芸、およびプランター栽培のAIエキスパートです。
以下の植物リストと、それぞれの最新の成長ログから、最も適した「収穫予定日（calculatedHarvestDate、形式: YYYY-MM-DD）」を論理的に推測・算定してください。

【検討材料】：
- sowingDate (播種日) からの経過日数
- 各品種(variety)の標準的な生育期間（例：レタス約40日、バジル約35日、ミニトマト約75日、イチゴ約90日など）
- stage (現在の段階。seedling, vegetative, flowering, harvest)
- 直近のログにおける成長の記述やコメント（元気がない、花が咲いた、気温が低いため水やりを控える、大雨、日照不足など）および測定値。

【植物リストデータ】:
${JSON.stringify(plantsPayload, null, 2)}

【特別条件】:
今日の日付は ${todayStr} です。推論する収穫予測日は本日 (${todayStr}) 以降の日付にしてください。
成長ログ等に「遅れ」「元気がない」「日照不足」「冷え込み」など生育トラブルがある場合は収穫予定日を少し後ろ倒し（例：3〜10日程度プラス）にし、
「順調」「蕾がふくらんだ」「たくさん結実した」「収穫できそう」など良い変化がある場合は、適正または少し前倒しの日付として評価してください。

各植物について「収穫予測日」と、その結論に至った科学的・園芸的アプローチに富む説明文（理由、日本語、30文字〜80文字程度、絵文字「🌱」「☀️」「⚠️」「🍎」を挿入して構いません）を生成してください。`;

        const response = await geminiClient.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: {
            systemInstruction: "あなたは家庭菜園やスマート水耕栽培の植物の成長動向を分析し、最適な収穫予定日を診断・更新するAIアドバイザーです。必ず指定した通りのJSON配列構造で正確に回答してください。",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  plantId: { type: Type.STRING },
                  calculatedHarvestDate: { type: Type.STRING, description: "収穫予想・算定予定日。YYYY-MM-DD形式" },
                  reason: { type: Type.STRING, description: "なぜそのように推測したのか、成長ログに基づいた園芸アドバイスを含めた分かりやすい解説。日本語で1〜2文。" }
                },
                required: ["plantId", "calculatedHarvestDate", "reason"]
              }
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (Array.isArray(parsed)) {
            aiPredictions = parsed;
            usedAi = true;
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn("Gemini harvest calculation error, falling back to local algorithm. Info:", errMsg);
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Quota") || errMsg.includes("limit")) {
          geminiError = "quota_exceeded";
        } else {
          geminiError = "api_error";
        }
      }
    }

    // Local Algorithm Fallback if AI is unconfigured/depleted properties/errored
    if (!usedAi) {
      aiPredictions = activePlants.map(p => {
        const logs = currentDb.growLogs
          .filter(l => l.plantId === p.id)
          .sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
        
        const sowing = new Date(p.sowingDate);
        let standardDays = 60; // default average
        const varietyLower = (p.variety || "").toLowerCase();
        
        if (varietyLower.includes("トマト") || varietyLower.includes("tomato")) {
          standardDays = 75;
        } else if (varietyLower.includes("レタス") || varietyLower.includes("lettuce") || varietyLower.includes("葉") || varietyLower.includes("ほうれん草")) {
          standardDays = 40;
        } else if (varietyLower.includes("バジル") || varietyLower.includes("ハーブ") || varietyLower.includes("ミント")) {
          standardDays = 35;
        } else if (varietyLower.includes("イチゴ") || varietyLower.includes("strawberry")) {
          standardDays = 90;
        }

        let adjustment = 0;
        if (p.stage === "flowering") {
          adjustment -= 5;
        } else if (p.stage === "harvest") {
          adjustment -= 15;
        }

        const logsText = logs.slice(0,5).map(l => (l.note || "")).join(" ");
        if (logsText.includes("遅") || logsText.includes("元気がない") || logsText.includes("枯れ") || logsText.includes("冷")) {
          adjustment += 7;
        }
        if (logsText.includes("順調") || logsText.includes("開花") || logsText.includes("実") || logsText.includes("おっきく") || logsText.includes("成長")) {
          adjustment -= 3;
        }

        const finalDate = new Date(sowing.getTime() + (standardDays + adjustment) * 24 * 60 * 60 * 1000);
        const today = new Date();
        today.setHours(0,0,0,0);
        let returnDate = finalDate;
        if (finalDate < today) {
          returnDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from today if theoretically in past
        }

        return {
          plantId: p.id,
          calculatedHarvestDate: returnDate.toISOString().substring(0, 10),
          reason: `標準適期(${standardDays}日間)を主軸に、現在の成長段階「${p.stage}」や、ログ(${logs.length}件)の記述傾向から自動算定した収穫予測日です。 🌱`
        };
      });
    }

    // Apply predictions to database and write back
    currentDb.harvestPredictions = currentDb.harvestPredictions || [];
    
    for (const pred of aiPredictions) {
      // 1. Update plant expectedHarvestDate directly
      const pIdx = currentDb.plants.findIndex(p => p.id === pred.plantId);
      if (pIdx !== -1) {
        currentDb.plants[pIdx].expectedHarvestDate = pred.calculatedHarvestDate;
        currentDb.plants[pIdx].updatedAt = new Date().toISOString();
      }

      // 2. Put prediction into our user-facing predictions table (overwrite or insert)
      const existingIdx = currentDb.harvestPredictions.findIndex(hp => hp.plantId === pred.plantId);
      const predictionRecord = {
        id: "pred-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
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
    writeDB(currentDb);
  }

  // Reload the updated DB to reply with proper user scoping
  const dbNow = readDB();
  const predictions = dbNow.harvestPredictions ? dbNow.harvestPredictions.filter(hp => 
    dbNow.plants.some(p => p.id === hp.plantId && p.userId === user.id && !p.archived && p.stage !== 'finished')
  ) : [];

  res.json({
    predictions,
    lastHarvestCalculationAt: dbNow.lastHarvestCalculationAt,
    calculatedThisTurn: shouldCalculate,
    geminiError
  });
});

app.put("/api/auth/profile", (req, res) => {
  const user = getUserContext(req);
  const { name, showPhEc } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  
  const currentDb = readDB();
  const idx = currentDb.users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    currentDb.users[idx].name = name;
    if (showPhEc !== undefined) {
      currentDb.users[idx].showPhEc = !!showPhEc;
    }
    currentDb.users[idx].updatedAt = new Date().toISOString();
    writeDB(currentDb);
    return res.json({ user: currentDb.users[idx] });
  }
  res.status(404).json({ error: "User not found" });
});

// Fetch current temperature based on user location using Gemini Search Grounding
app.get("/api/weather-current", async (req, res) => {
  const user = getUserContext(req);
  const location = (req.query.location as string || "長野県長野市").trim();
  
  let currentTemp = 20; // Default fallback
  
  if (geminiClient) {
    try {
      const prompt = `「${location}」の現在の最高気温、最低気温、平均的な外気温を調べてください。
数値を1つだけ。水耕栽培や土耕栽培の測定データに自動入力するための「摂氏（℃、Celsius）の現在（最高または平均）気温」を半角数値（小数点1位以下は四捨五入して整数、または1位まで、例: 22 または 21.5）だけで出力してください。
【注意：華氏と摂氏の混同禁止】絶対に華氏（°F）の生の数値をそのまま出力しないでください。華氏で情報が取得された場合は必ず摂氏（℃）に変換してください。日本において「80℃」や「75℃」などの気温は物理的に不可能です。
単位、テキスト、前置きは一切不要です。（出力形式の例： 21.5 または 18）`;

      const aiResponse = await geminiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "あなたは現在のリアルタイムの現地気温を計測して数値だけで回答するシステムです。気温は必ず「摂氏（℃）」で答え、華氏（°F）をそのまま出力することは厳禁です。余計な文字列（「摂氏」「度」「°C」など）を絶対に含めないで、数値「23.1」や「18」のように出力します。",
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = aiResponse.text?.trim() || "";
      const match = text.match(/[\d.]+/);
      if (match) {
        let val = parseFloat(match[0]);
        // 華氏の誤認（例: 日本で45℃以上の気温は極めて稀、70℃〜100℃は確実に華氏誤認）に対する自動セーフティガード
        if (val > 45) {
          val = Math.round(((val - 32) * 5 / 9) * 10) / 10;
        }
        currentTemp = val;
      }
    } catch (err: any) {
      console.warn("Weather temp Gemini search failed:", err);
    }
  } else {
    // Month fallback
    const month = new Date().getMonth() + 1;
    const monthlyTemps = [5, 6, 12, 17, 21, 24, 28, 29, 25, 19, 13, 8];
    currentTemp = monthlyTemps[month - 1];
  }

  res.json({ temp: currentTemp });
});


// --- SYSTEMS ENDPOINTS ---
app.get("/api/systems", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();
  
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

app.post("/api/systems", (req, res) => {
  const user = getUserContext(req);
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
  
  const currentDb = readDB();
  currentDb.systems.push(newSys);
  writeDB(currentDb);
  res.status(210).json(newSys);
});

app.put("/api/systems/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { name, type, description, suspended } = req.body;
  
  const currentDb = readDB();
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
  
  writeDB(currentDb);
  res.json(currentDb.systems[idx]);
});

app.delete("/api/systems/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  
  const currentDb = readDB();
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
  
  writeDB(currentDb);
  res.json({ success: true });
});


// --- PLANTS & SHARING ENDPOINTS ---
app.get("/api/plants", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();
  
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
    return {
      ...p,
      systemName: sys ? sys.name : "不明なプランター",
      systemType: sys ? sys.type : "Other",
      latestPh: latest ? latest.ph : null,
      latestEc: latest ? latest.ec : null,
      latestWaterTemp: latest ? latest.waterTemp : null,
      latestLogAt: latest ? latest.loggedAt : null,
      role: isSysOwner ? "owner" : (membership ? membership.role : "member")
    };
  });
  
  res.json(results);
});

app.get("/api/plants/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const currentDb = readDB();
  
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
    
  const nutrients = currentDb.nutrientLogs
    .filter(nl => nl.plantId === id)
    .map(l => {
      const poster = currentDb.users.find(u => u.id === l.postedBy);
      return { ...l, postedByName: poster ? poster.name : "不明" };
    })
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    
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

app.post("/api/plants", (req, res) => {
  const user = getUserContext(req);
  const { systemId, name, variety, stage, sowingDate, expectedHarvestDate } = req.body;
  if (!systemId || !name) {
    return res.status(400).json({ error: "systemId and Name are required" });
  }
  
  const currentDb = readDB();
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
    updatedAt: new Date().toISOString()
  };
  
  currentDb.plants.push(newPlant);
  writeDB(currentDb);
  res.status(201).json(newPlant);
});

app.put("/api/plants/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { name, variety, stage, sowingDate, expectedHarvestDate, systemId, archived } = req.body;
  
  const currentDb = readDB();
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
  currentDb.plants[idx].updatedAt = new Date().toISOString();
  
  writeDB(currentDb);
  res.json(currentDb.plants[idx]);
});

app.delete("/api/plants/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  
  const currentDb = readDB();
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
  
  writeDB(currentDb);
  res.json({ success: true });
});

// Invite member to joint cultivate list (Planter/System level)
app.post("/api/systems/:id/members", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = readDB();
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
  writeDB(currentDb);
  res.json({ success: true, memberUser: targetUser });
});

// Backward compatibility helper for plant level invitation (delegates to system/planter level)
app.post("/api/plants/:id/members", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const currentDb = readDB();
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
  writeDB(currentDb);
  res.json({ success: true, memberUser: targetUser });
});

// Evict or leave planter group
app.delete("/api/systems/:id/members/:userId", (req, res) => {
  const user = getUserContext(req);
  const { id, userId } = req.params;
  
  const currentDb = readDB();
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
    writeDB(currentDb);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: "Member not found" });
});


// プランター単体での共同栽培メンバーの招待
app.post("/api/systems/:id/members", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params; // system id
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "メールアドレスを入力してください" });
  }

  const currentDb = readDB();
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
  writeDB(currentDb);

  res.json({ success: true, member: { userId: targetUser.id, name: targetUser.name, email: targetUser.email, role: "member" } });
});

// プランター単体での共同栽培メンバーの解任・辞退
app.delete("/api/systems/:id/members/:userId", (req, res) => {
  const user = getUserContext(req);
  const { id, userId } = req.params;

  const currentDb = readDB();
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
    writeDB(currentDb);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "栽培メンバーが見つかりません" });
});

// Backward compatibility helper for plant level eviction
app.delete("/api/plants/:id/members/:userId", (req, res) => {
  const user = getUserContext(req);
  const { id, userId } = req.params;
  
  const currentDb = readDB();
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
    writeDB(currentDb);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: "Member not found" });
});


// 所有者の変更 (Transfer Ownership) for System
app.put("/api/systems/:id/transfer-owner", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { newOwnerUserId } = req.body;
  if (!newOwnerUserId) {
    return res.status(400).json({ error: "新しい代表者の指定が必要です" });
  }

  const currentDb = readDB();
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

  writeDB(currentDb);
  res.json({ success: true, newOwner: targetUser });
});

// 所有者の変更 (Transfer Ownership) for Plant wrapper
app.put("/api/plants/:id/transfer-owner", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { newOwnerUserId } = req.body;
  if (!newOwnerUserId) {
    return res.status(400).json({ error: "新しい代表者の指定が必要です" });
  }

  const currentDb = readDB();
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

  writeDB(currentDb);
  res.json({ success: true, newOwner: targetUser });
});


// --- GROW LOGS ENDPOINTS ---
app.post("/api/grow-logs", (req, res) => {
  const user = getUserContext(req);
  const { plantId, ph, ec, waterTemp, note, loggedAt, watered, imageUrl, imageUrls } = req.body;
  if (!plantId) {
    return res.status(400).json({ error: "plantId is required" });
  }
  
  const currentDb = readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const newLog: GrowLog = {
    id: "log-" + Date.now(),
    plantId,
    postedBy: user.id,
    ph: ph !== "" && ph !== undefined ? parseFloat(ph) : null,
    ec: ec !== "" && ec !== undefined ? parseFloat(ec) : null,
    waterTemp: waterTemp !== "" && waterTemp !== undefined ? parseFloat(waterTemp) : null,
    note: note || "",
    loggedAt: loggedAt || new Date().toISOString(),
    watered: watered !== undefined ? Boolean(watered) : true,
    imageUrl: imageUrl || undefined,
    imageUrls: imageUrls || undefined
  };
  
  currentDb.growLogs.push(newLog);
  writeDB(currentDb);
  res.status(201).json({ ...newLog, postedByName: user.name });
});

app.put("/api/grow-logs/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { ph, ec, waterTemp, note, loggedAt, watered, imageUrl, imageUrls } = req.body;

  const currentDb = readDB();
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

  writeDB(currentDb);
  res.json(currentDb.growLogs[idx]);
});

app.get("/api/proposals", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();

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

app.put("/api/proposals/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { status, proposedDate, type, note } = req.body;
  
  const currentDb = readDB();
  const idx = currentDb.scheduleProposals.findIndex(sp => sp.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  
  if (status) currentDb.scheduleProposals[idx].status = status;
  if (proposedDate) currentDb.scheduleProposals[idx].proposedDate = proposedDate;
  if (type) currentDb.scheduleProposals[idx].type = type;
  if (note !== undefined) currentDb.scheduleProposals[idx].note = note;
  
  writeDB(currentDb);
  res.json(currentDb.scheduleProposals[idx]);
});

app.put("/api/schedule-proposals/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { status, proposedDate, type, note } = req.body; // approved / dismissed / pending
  
  const currentDb = readDB();
  const idx = currentDb.scheduleProposals.findIndex(sp => sp.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  
  if (status) currentDb.scheduleProposals[idx].status = status;
  if (proposedDate) currentDb.scheduleProposals[idx].proposedDate = proposedDate;
  if (type) currentDb.scheduleProposals[idx].type = type;
  if (note !== undefined) currentDb.scheduleProposals[idx].note = note;
  
  writeDB(currentDb);
  res.json(currentDb.scheduleProposals[idx]);
});


// --- AI INTERACT ADVICE ENDPOINT (Using Gemini + Google Search Grounding for micro-climate analysis) ---
app.post("/api/ai/chat", async (req, res) => {
  const user = getUserContext(req);
  const { plantId, message, userLocation } = req.body;
  
  if (!plantId || !message) {
    return res.status(400).json({ error: "Plant ID and message content are required" });
  }
  
  const currentDb = readDB();
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
現在、ユーザーは水耕栽培の高度なパラメーター管理だけでなく、土を使ったプランター栽培、地植えの家庭菜園、露地畑など、様々な環境で植物を栽培しています。

【植物のプロフィール】
- 植物名: ${plant.name}
- 品種: ${plant.variety}
- 育成ステージ: ${plant.stage} (苗期: seedling, 栄養成長期: vegetative, 開花期: flowering, 収穫期: harvest, 栽培終了: finished)
- 播種日(種まき): ${plant.sowingDate}
- 予想収穫日: ${plant.expectedHarvestDate}
- 栽培環境・プランター: ${sys ? sys.name : "その他"} (形式: ${sys ? sys.type : "Other"})
- 地域・気候パラメーター: ${userLocation || "未設定 (特に長野など寒暖差の大きい地域、日本の微細気候に対応)"}

【最近5回分の観察・記録ログ】
${logSummary || "（まだログはありません。弱酸性のpH 5.8~6.5、EC 1.0~2.5程度。プランターや畑などの土耕なら、土の乾き具合、病害虫、日当たりなどの詳細な観察が記録されます）"}

【直近3回分の施肥・栄養記録】
${fertSummary || "（まだ肥料の添加記録はありません）"}

【アドバイス方針】
1. プランター種別が水耕の場合：日本の定番液肥「ハイポニカ」「OATハウス」「微粉ハイポネックス」などの配合設計や、pH / EC / 水温・根腐れの的確なアドバイスを行います。
2. プランター種別が土耕・地植え畑の場合：水やり頻度（土が乾いたらたっぷり鉢底から流れるまで）、プランター特有の熱対策・底面潅水、追肥（マグァンプKやマイガーデン等の固形化成肥料や液体肥料の土壌散布）、芽かき（わき芽かき）、摘心、土寄せ、マルチング等、それぞれの特性に基づいた実直で丁寧なアドバイスをします。
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
        model: "gemini-3.1-flash-lite",
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
      const isSoil = sys && (sys.type === "Soil_Planter" || sys.type === "Backyard_Field");
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
    const isSoil = sys && (sys.type === "Soil_Planter" || sys.type === "Backyard_Field");
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
  
  writeDB(currentDb);
  res.json({ response: assistantText, messages: [userMsg, assistantMsg] });
});


// --- AI CALENDAR PROPOSAL AUTOMATIC GENERATOR ---
app.post("/api/ai/propose-schedule", async (req, res) => {
  const user = getUserContext(req);
  const { plantId, userLocation } = req.body;
  if (!plantId) {
    return res.status(400).json({ error: "Plant ID is required to synthesize schedules" });
  }
  
  const currentDb = readDB();
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
- プランター・環境タイプ: ${sys ? sys.type : "DWC"}
- 地域気候情報: ${userLocation || "長野県（日本の典型的な気候）"}
- 計算の基準日(本日): ${new Date().toISOString().split("T")[0]}
`;

  let proposalsSeed: any[] = [];
  
  if (geminiClient) {
    try {
      const response = await geminiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
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
  writeDB(currentDb);
  
  res.json({ success: true, proposals: newProposals });
});

// Fallback algorithm computation for proposals
function generateFallbackProposals(plant: Plant, sys: any, location: string, showPhEc = true): any[] {
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 3600_000).toISOString().split("T")[0];
  const region = location || "長野などの寒暖差エリア";
  
  const isSoil = sys && (sys.type === "Soil_Planter" || sys.type === "Backyard_Field");
  
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
app.get("/api/calendar/export", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();
  
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


// Serve static files in production OR Vite middleware in dev
const distPath = path.join(process.cwd(), "dist");

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // Wait before async start server to mount vite middleware properly
  startViteDevServer();
}

async function startViteDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  
  app.use(vite.middlewares);
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Development custom fullstack server running on http://localhost:${PORT}`);
  });
}

// Support container fallback runtime direct listen if already booted in production
if (process.env.NODE_ENV === "production") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production custom fullstack server running on port ${PORT}`);
  });
}
