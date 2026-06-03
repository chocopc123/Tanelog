import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
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
  User, System, Plant, PlantMember, GrowLog, PlantPhoto, 
  NutrientLog, ChatMessage, ScheduleProposal 
} from "./src/types";

interface DBStructure {
  users: User[];
  systems: System[];
  plants: Plant[];
  plantMembers: PlantMember[];
  growLogs: GrowLog[];
  plantPhotos: PlantPhoto[];
  nutrientLogs: NutrientLog[];
  chatMessages: ChatMessage[];
  scheduleProposals: ScheduleProposal[];
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
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to read database, returning empty schemas:", error);
    return {
      users: [],
      systems: [],
      plants: [],
      plantMembers: [],
      growLogs: [],
      plantPhotos: [],
      nutrientLogs: [],
      chatMessages: [],
      scheduleProposals: []
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
    name: "リビングのDWC装置 (循環水耕)",
    type: "DWC",
    description: "自作の深水循環式コップ栽培セット。エアーポンプ付きの室内水耕ユニット。",
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

  // Plant Collaboration members
  const member1: PlantMember = {
    id: "member-1",
    plantId: "plant-1",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member2: PlantMember = {
    id: "member-2",
    plantId: "plant-1",
    userId: "user-2",
    role: "member",
    joinedAt: new Date().toISOString()
  };

  const member3: PlantMember = {
    id: "member-3",
    plantId: "plant-2",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member4: PlantMember = {
    id: "member-4",
    plantId: "plant-3",
    userId: "user-1",
    role: "owner",
    joinedAt: new Date().toISOString()
  };

  const member5: PlantMember = {
    id: "member-5",
    plantId: "plant-3",
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
    plantMembers: [member1, member2, member3, member4, member5],
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

app.put("/api/auth/profile", (req, res) => {
  const user = getUserContext(req);
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  
  const currentDb = readDB();
  const idx = currentDb.users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    currentDb.users[idx].name = name;
    currentDb.users[idx].updatedAt = new Date().toISOString();
    writeDB(currentDb);
    return res.json({ user: currentDb.users[idx] });
  }
  res.status(404).json({ error: "User not found" });
});


// --- SYSTEMS ENDPOINTS ---
app.get("/api/systems", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();
  // Return systems owned by the user
  const systems = currentDb.systems.filter(s => s.userId === user.id);
  res.json(systems);
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
    currentDb.plantMembers = currentDb.plantMembers.filter(m => !plantIds.includes(m.plantId));
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
  
  // Find plants owned by the user OR where the user is a plant member (collaborative role)
  const plantIdsAllowed = currentDb.plantMembers
    .filter(pm => pm.userId === user.id)
    .map(pm => pm.plantId);
    
  const allowedPlants = currentDb.plants.filter(p => p.userId === user.id || plantIdsAllowed.includes(p.id));
  
  // Hydrate with latest stats (latest pH, EC, waterTemp) and systems details
  const results = allowedPlants.map(p => {
    const sys = currentDb.systems.find(s => s.id === p.systemId);
    const logs = currentDb.growLogs.filter(gl => gl.plantId === p.id);
    const sorted = [...logs].sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    const latest = sorted[0] || null;
    
    // Check if user is owner or member
    const membership = currentDb.plantMembers.find(m => m.plantId === p.id && m.userId === user.id);
    return {
      ...p,
      systemName: sys ? sys.name : "不明な装置",
      systemType: sys ? sys.type : "Other",
      latestPh: latest ? latest.ph : null,
      latestEc: latest ? latest.ec : null,
      latestWaterTemp: latest ? latest.waterTemp : null,
      latestLogAt: latest ? latest.loggedAt : null,
      role: membership ? membership.role : "owner"
    };
  });
  
  res.json(results);
});

app.get("/api/plants/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const currentDb = readDB();
  
  // Authorization check: User must be owner OR joint plant_member
  const isMember = currentDb.plantMembers.some(pm => pm.plantId === id && pm.userId === user.id);
  const plant = currentDb.plants.find(p => p.id === id);
  
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  if (plant.userId !== user.id && !isMember) {
    return res.status(403).json({ error: "No permission to view this plant" });
  }
  
  // Hydrate detailed logs, photos, nutrient records, schedule proposals, messages
  const sys = currentDb.systems.find(s => s.id === plant.systemId);
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
    
  const members = currentDb.plantMembers
    .filter(pm => pm.plantId === id)
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
    
  res.json({
    ...plant,
    system: sys ? { name: sys.name, type: sys.type, description: sys.description } : null,
    growLogs: logs,
    plantPhotos: photos,
    nutrientLogs: nutrients,
    proposals,
    chatMessages,
    members,
    currentUserRole: currentDb.plantMembers.find(pm => pm.plantId === id && pm.userId === user.id)?.role || "owner"
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
    return res.status(400).json({ error: "栽培装置が見つかりません" });
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
  
  // Register automatic plant_member for owner
  const ownMember: PlantMember = {
    id: "m-" + Date.now(),
    plantId: newPlant.id,
    userId: user.id,
    role: "owner",
    joinedAt: new Date().toISOString()
  };
  
  currentDb.plants.push(newPlant);
  currentDb.plantMembers.push(ownMember);
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
  currentDb.plantMembers = currentDb.plantMembers.filter(m => m.plantId !== id);
  currentDb.growLogs = currentDb.growLogs.filter(gl => gl.plantId !== id);
  currentDb.nutrientLogs = currentDb.nutrientLogs.filter(nl => nl.plantId !== id);
  currentDb.plantPhotos = currentDb.plantPhotos.filter(ph => ph.plantId !== id);
  currentDb.scheduleProposals = currentDb.scheduleProposals.filter(sp => sp.plantId !== id);
  currentDb.chatMessages = currentDb.chatMessages.filter(cm => cm.plantId !== id);
  
  writeDB(currentDb);
  res.json({ success: true });
});

// Invite member to joint cultivate list
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
  
  // Must be owner or existing member to invite
  const requesterIsMember = currentDb.plantMembers.some(pm => pm.plantId === id && pm.userId === user.id);
  if (plant.userId !== user.id && !requesterIsMember) {
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
  
  // Check if already is member
  const alreadyMember = currentDb.plantMembers.some(pm => pm.plantId === id && pm.userId === targetUser!.id);
  if (alreadyMember) {
    return res.status(440).json({ error: "このユーザーは既に共同栽培を行っています" });
  }
  
  const newMember: PlantMember = {
    id: "m-" + Date.now(),
    plantId: id,
    userId: targetUser.id,
    role: "member",
    joinedAt: new Date().toISOString()
  };
  
  currentDb.plantMembers.push(newMember);
  writeDB(currentDb);
  res.json({ success: true, memberUser: targetUser });
});

// Exit joint cultivation context or kick out member
app.delete("/api/plants/:id/members/:userId", (req, res) => {
  const user = getUserContext(req);
  const { id, userId } = req.params;
  
  const currentDb = readDB();
  const plant = currentDb.plants.find(p => p.id === id);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  // Only owner can kick, but anyone can leave by themselves
  if (plant.userId !== user.id && user.id !== userId) {
    return res.status(403).json({ error: "メンバー退出・解任操作を行う権限がありません" });
  }
  
  if (plant.userId === userId) {
    return res.status(400).json({ error: "オーナーは退出できません。植物そのものを削除してください。" });
  }
  
  const idx = currentDb.plantMembers.findIndex(pm => pm.plantId === id && pm.userId === userId);
  if (idx !== -1) {
    currentDb.plantMembers.splice(idx, 1);
    writeDB(currentDb);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: "Member not found" });
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
  if (note !== undefined) currentDb.growLogs[idx].note = note || "";
  if (loggedAt !== undefined) currentDb.growLogs[idx].loggedAt = loggedAt || new Date().toISOString();
  if (watered !== undefined) currentDb.growLogs[idx].watered = Boolean(watered);
  if (imageUrl !== undefined) currentDb.growLogs[idx].imageUrl = imageUrl || undefined;
  if (imageUrls !== undefined) currentDb.growLogs[idx].imageUrls = imageUrls || undefined;

  writeDB(currentDb);
  res.json({ ...currentDb.growLogs[idx], postedByName: user.name });
});

app.delete("/api/grow-logs/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;

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

  currentDb.growLogs.splice(idx, 1);
  writeDB(currentDb);
  res.json({ success: true });
});


// --- NUTRIENT LOGS ENDPOINTS ---
app.post("/api/nutrient-logs", (req, res) => {
  const user = getUserContext(req);
  const { plantId, brand, dilutionRate, amountMl, note, appliedAt } = req.body;
  if (!plantId || !brand) {
    return res.status(400).json({ error: "plantId and fertilizer brand are required" });
  }
  
  const currentDb = readDB();
  const plant = currentDb.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }
  
  const newNLog: NutrientLog = {
    id: "nlog-" + Date.now(),
    plantId,
    postedBy: user.id,
    brand,
    dilutionRate: dilutionRate ? parseInt(dilutionRate) : 500,
    amountMl: amountMl ? parseInt(amountMl) : 5,
    note: note || "",
    appliedAt: appliedAt || new Date().toISOString()
  };
  
  currentDb.nutrientLogs.push(newNLog);
  writeDB(currentDb);
  res.status(201).json({ ...newNLog, postedByName: user.name });
});

app.put("/api/nutrient-logs/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { brand, dilutionRate, amountMl, note, appliedAt } = req.body;

  const currentDb = readDB();
  const idx = currentDb.nutrientLogs.findIndex(l => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Nutrient log not found" });
  }

  const log = currentDb.nutrientLogs[idx];
  const plant = currentDb.plants.find(p => p.id === log.plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }

  // Permission check: poster or plant owner
  if (log.postedBy !== user.id && plant.userId !== user.id) {
    return res.status(403).json({ error: "許可されていません" });
  }

  if (brand) currentDb.nutrientLogs[idx].brand = brand;
  if (dilutionRate !== undefined) currentDb.nutrientLogs[idx].dilutionRate = dilutionRate ? parseInt(dilutionRate) : 500;
  if (amountMl !== undefined) currentDb.nutrientLogs[idx].amountMl = amountMl ? parseInt(amountMl) : 5;
  if (note !== undefined) currentDb.nutrientLogs[idx].note = note || "";
  if (appliedAt !== undefined) currentDb.nutrientLogs[idx].appliedAt = appliedAt || new Date().toISOString();

  writeDB(currentDb);
  res.json({ ...currentDb.nutrientLogs[idx], postedByName: user.name });
});

app.delete("/api/nutrient-logs/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;

  const currentDb = readDB();
  const idx = currentDb.nutrientLogs.findIndex(l => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Nutrient log not found" });
  }

  const log = currentDb.nutrientLogs[idx];
  const plant = currentDb.plants.find(p => p.id === log.plantId);
  if (!plant) {
    return res.status(404).json({ error: "Plant not found" });
  }

  // Permission check: poster or plant owner
  if (log.postedBy !== user.id && plant.userId !== user.id) {
    return res.status(403).json({ error: "許可されていません" });
  }

  currentDb.nutrientLogs.splice(idx, 1);
  writeDB(currentDb);
  res.json({ success: true });
});


// --- PLANT PHOTOS API (Base64 file upload proxy) ---
app.post("/api/photos", (req, res) => {
  const user = getUserContext(req);
  const { plantId, growLogId, storageKey, caption, takenAt } = req.body;
  if (!plantId || !storageKey) {
    return res.status(400).json({ error: "plantId and image storageKey data-URI is required" });
  }
  
  const newPhoto: PlantPhoto = {
    id: "photo-" + Date.now(),
    plantId,
    growLogId: growLogId || null,
    postedBy: user.id,
    storageKey, // Base64 encoded crop growth snapshot
    caption: caption || "植物成長記録スナップ",
    takenAt: takenAt || new Date().toISOString()
  };
  
  const currentDb = readDB();
  currentDb.plantPhotos.push(newPhoto);
  writeDB(currentDb);
  res.status(201).json(newPhoto);
});


// --- SCHEDULE PROPOSALS (APPROVED / PENDING / DISMISSED) ---
app.get("/api/proposals", (req, res) => {
  const user = getUserContext(req);
  const currentDb = readDB();
  
  // Search plant memberships for joint accounts
  const jointPlantIds = currentDb.plantMembers
    .filter(pm => pm.userId === user.id)
    .map(pm => pm.plantId);
    
  const userPlantIds = currentDb.plants
    .filter(p => p.userId === user.id)
    .map(p => p.id);
    
  const allowedIds = Array.from(new Set([...jointPlantIds, ...userPlantIds]));
  
  // Find proposals for user belonging plants OR marked as requested for that userID
  const list = currentDb.scheduleProposals.filter(p => allowedIds.includes(p.plantId) || p.userId === user.id);
  
  // Decorate with hydrated plant detailed name
  const decoratedList = list.map(item => {
    const p = currentDb.plants.find(plantItem => plantItem.id === item.plantId);
    return {
      ...item,
      plantName: p ? p.name : "退会された植物"
    };
  });
  
  res.json(decoratedList);
});

// Update approved date and status
app.put("/api/proposals/:id", (req, res) => {
  const user = getUserContext(req);
  const { id } = req.params;
  const { status, proposedDate } = req.body; // approved / dismissed / pending
  
  const currentDb = readDB();
  const idx = currentDb.scheduleProposals.findIndex(sp => sp.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  
  if (status) currentDb.scheduleProposals[idx].status = status;
  if (proposedDate) currentDb.scheduleProposals[idx].proposedDate = proposedDate;
  
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
  
  // Retrieve plant metadata to construct context system guidelines
  const sys = currentDb.systems.find(s => s.id === plant.systemId);
  const recentLogs = currentDb.growLogs
    .filter(l => l.plantId === plantId)
    .sort((a,b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, 5);
    
  const recentFertilizers = currentDb.nutrientLogs
    .filter(n => n.plantId === plantId)
    .sort((a,b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 3);
    
  // Format current parameters cleanly
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
- 栽培環境・装置: ${sys ? sys.name : "その他"} (形式: ${sys ? sys.type : "Other"})
- 地域・気候パラメーター: ${userLocation || "未設定 (特に長野など寒暖差の大きい地域、日本の微細気候に対応)"}

【最近5回分の観察・記録ログ】
${logSummary || "（まだログはありません。水耕ならpH 5.8~6.2、EC 1.2~2.4程度。プランターや畑などの土耕なら、土の乾き具合、病害虫、日当たりなどの詳細な観察が記録されます）"}

【直近3回分の施肥・栄養記録】
${fertSummary || "（まだ肥料 of 添加記録はありません。水耕用のハイポニカやOATハウス等の液肥配合、土耕用の固形化成肥料、有機堆肥、マルチングなどの各種栄養補正を推奨）"}

【アドバイス方針】
1. 装置タイプが水耕の場合（DWC/NFT/Kratky/Ebb_Flow）：日本の定番液肥「ハイポニカ」「OATハウス（旧大塚ハウス）」「微粉ハイポネックス」などの配合設計や、pH / EC / 水温・根腐れの的確なアドバイスを行います。
2. 装置タイプが土耕・プランター・地植え畑の場合（Soil_Planter / Backyard_Field / Other）：水やり頻度（土が乾いたらたっぷり鉢底から流れるまで）、プランター特有の熱対策・底面潅水、追肥（マグァンプKやマイガーデン等の固形化成肥料や液体肥料の土壌散布）、芽かき（わき芽かき）、摘心、土寄せ、マルチング等、それぞれの特性に基づいた実直で丁寧なアドバイスをします。
3. ユーザーが指定した地域（${userLocation || "日本"}）の現在の季節要因（寒冷期の地温、梅雨期の過湿、夏の日射・水温急上昇など）を十分に考慮します。
4. なぜ葉が黄色くなるのか、成長が遅いのか、病害虫の疑いはないか、植物生理学に基づきつつも初心者へ分かりやすく丁寧に説明してください。
5. 回答は過剰な装飾をせず、親身でスマートなマークダウン形式の日本語で回答します。
`;

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
      
    } catch (aiError) {
      console.error("Gemini Content Generation Error:", aiError);
      const isSoil = sys && (sys.type === "Soil_Planter" || sys.type === "Backyard_Field");
      if (isSoil) {
        assistantText = `【オフライン診断モード】Gemini APIを呼び出す際にエラーが発生しました。
プランター/菜園栽培のアドバイス例として：
- 土耕・プランター栽培では、土の乾湿リズム（乾いたらたっぷり潅水）を意識してください。
- 脇芽かき（pruning）や摘心をすることで、風通しを高め病害虫を予防できます。
(エラー詳細: ${aiError instanceof Error ? aiError.message : aiError})`;
      } else {
        assistantText = `【オフライン診断モード】Gemini APIを呼び出す際にエラーが発生しました。
水耕栽培のアドバイス例として：
- pHが${recentLogs[0]?.ph || "記録なし"}と表示されていますが、通常は5.8〜6.5が適正です。
- 根腐れのケア、液肥の2段階希釈などの対応をしてください。
(エラー詳細: ${aiError instanceof Error ? aiError.message : aiError})`;
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
  
  const prompt = `
あなたは「家庭菜園・プランター・スマート栽培の専門AIアドバイザー」です。対象の植物とプランター栽培環境（土耕プランターか水耕かなど）を分析し、**栽培スケジュールカレンダーのイベント案をJSON形式で2〜3件**作成してください。
必ず、以下のJSON配列形式のみを出力してください。余計なマークダウンのバッククォーツ（\`\`\`json など）や文章は一切含めず、プレーンテキストとしてJSONオブジェクトを返してください。

[
  {
    "type": "nutrient" | "water_change" | "ph_check" | "harvest",
    "proposedDate": "YYYY-MM-DD",
    "note": "カレンダー記載用の詳細な解説"
  }
]

【カレンダー提案ルール】
- 施肥(\`nutrient\`): 液肥「ハイポニカ」500倍、「OATハウス」1000倍など日本の定番肥料に合わせた希釈案内。
- 全水換え(\`water_change\`): 根腐れや藻の発生を防ぐための、栽培水の総交換リフレッシュ案。
- 測定・確認(\`ph_check\`): pH値が酸性・アルカリ性に傾いていないかのチェック推奨。
- 収穫(\`harvest\`): 品種や播種日から想定される推奨収穫タイミング。

【分析する植物データ】
- 植物名: ${plant.name}
- 品種: ${plant.variety}
- 現在の育成ステージ: ${plant.stage}
- 種まき日: ${plant.sowingDate}
- 予想収穫日: ${plant.expectedHarvestDate}
- 装置種類: ${sys ? sys.type : "DWC"}
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
    } catch (apiErr) {
      console.error("Failed to generate propose schedules with Gemini. Using high-precision local fallback computation:", apiErr);
      proposalsSeed = generateFallbackProposals(plant, sys, userLocation);
    }
  } else {
    proposalsSeed = generateFallbackProposals(plant, sys, userLocation);
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
function generateFallbackProposals(plant: Plant, sys: any, location: string): any[] {
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
  const userPlantIds = currentDb.plants.filter(p => p.userId === user.id).map(p => p.id);
  const allowedIds = currentDb.plantMembers
    .filter(pm => pm.userId === user.id)
    .map(pm => pm.plantId)
    .concat(userPlantIds);
    
  const approvedProposals = currentDb.scheduleProposals.filter(
    sp => allowedIds.includes(sp.plantId) && sp.status === "approved"
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
