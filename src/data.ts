import { StackFeature, NearbyUser, LocalCommunity } from "./types";

export const STACK_FEATURES: StackFeature[] = [
  {
    feature: "Authentication",
    freeService: "Firebase Authentication",
    purpose: "Provides secure, free email & social login with simple SDK configuration.",
    icon: "Lock",
    category: "Security",
    implementationGuide: `import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign Up
const registerUser = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};`
  },
  {
    feature: "Database",
    freeService: "MongoDB Atlas Free",
    purpose: "Generous 512MB free Shared M0 cluster for document-oriented user/chat storage.",
    icon: "Database",
    category: "Core",
    implementationGuide: `const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://<user>:<password>@cluster0.mongodb.net/chatDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
  translatedText: String
});

const Message = mongoose.model("Message", MessageSchema);`
  },
  {
    feature: "Real-time Chat",
    freeService: "Socket.IO",
    purpose: "Bi-directional, low-latency communication engine with auto-fallback to HTTP polling.",
    icon: "MessageSquare",
    category: "Core",
    implementationGuide: `// SERVER SIDE (Node.js)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);
  
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  socket.on("send_msg", (data) => {
    socket.to(data.roomId).emit("receive_msg", data);
  });
});`
  },
  {
    feature: "Backend Hosting",
    freeService: "Render",
    purpose: "Deploy and host your live Node.js Node app with free automatic SSL certificates.",
    icon: "Server",
    category: "Core",
    implementationGuide: `# Render build configuration
# Build Command: npm install && npm run build
# Start Command: node dist/server.cjs
# Environment variables are managed securely in Render's dashboard.`
  },
  {
    feature: "Frontend Hosting",
    freeService: "Vercel / Netlify",
    purpose: "Superfast static or hybrid hosting integrated with GitHub CI/CD pipelines.",
    icon: "Globe",
    category: "Core",
    implementationGuide: `# Create vercel.json in project root
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-backend.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}`
  },
  {
    feature: "File Storage",
    freeService: "Cloudinary",
    purpose: "Free tier offers 25GB monthly bandwidth and storage for chat assets.",
    icon: "Image",
    category: "Core",
    implementationGuide: `const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: "YOUR_CLOUD_NAME",
  api_key: "YOUR_API_KEY",
  api_secret: "YOUR_API_SECRET"
});

// Upload direct from server/buffer
const uploadAsset = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: "chat_attachments" }, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    }).end(fileBuffer);
  });
};`
  },
  {
    feature: "Voice & Video Calls",
    freeService: "WebRTC",
    purpose: "Peer-to-peer browser capability. Free public STUN servers handle connection paths.",
    icon: "PhoneCall",
    category: "Calls",
    implementationGuide: `// Initiate a P2P RTCPeerConnection
const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const peerConnection = new RTCPeerConnection(configuration);

// Add camera/mic stream
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

// Create Offer to Peer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);
// Send 'offer' to partner via Socket.IO signaling channel`
  },
  {
    feature: "Maps",
    freeService: "OpenStreetMap",
    purpose: "Free, open geographical map data without the strict billing requests of Google Maps.",
    icon: "Map",
    category: "Social",
    implementationGuide: `// React integration using Leaflet & OpenStreetMap tiles
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

function MapView({ userLat, userLng }) {
  return (
    <MapContainer center={[userLat, userLng]} zoom={13} style={{ height: "400px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[userLat, userLng]}>
        <Popup>Approximate Location (Privacy Safe)</Popup>
      </Marker>
    </MapContainer>
  );
}`
  },
  {
    feature: "Geocoding",
    freeService: "Nominatim API",
    purpose: "Convert GPS coordinates into readable human addresses (privacy-safe search queries).",
    icon: "Compass",
    category: "Social",
    implementationGuide: `// Free reverse geocoding via Nominatim OpenStreetMap API
async function getApproximateAddress(lat, lng) {
  try {
    const response = await fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${lat}&lon=\${lng}&zoom=14\`);
    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (err) {
    console.error(err);
    return "Error fetching location";
  }
}`
  },
  {
    feature: "Push Notifications",
    freeService: "Firebase Cloud Messaging",
    purpose: "Send native alert popups to users' browsers even if the tab is inactive.",
    icon: "Bell",
    category: "Security",
    implementationGuide: `import { getMessaging, getToken, onMessage } from "firebase/messaging";

const messaging = getMessaging(app);

// Request user's browser token
const requestPermission = async () => {
  const currentToken = await getToken(messaging, { vapidKey: "YOUR_PUBLIC_VAPID_KEY" });
  if (currentToken) {
    console.log("Device push token:", currentToken);
    // Store in database with your User model
  }
};`
  },
  {
    feature: "Avatars",
    freeService: "DiceBear Avatars API",
    purpose: "Generates beautiful dynamic vector avatars matching the chat user's profile username.",
    icon: "User",
    category: "Fun",
    implementationGuide: `// Render dynamic customized SVG avatars from usernames
function AvatarImage({ seed }) {
  // Styles include: bottts, adventurer, lorelei, personas, initials
  const avatarUrl = \`https://api.dicebear.com/7.x/adventurer/svg?seed=\${encodeURIComponent(seed)}\`;
  return <img src={avatarUrl} alt="User profile avatar" className="w-12 h-12 rounded-full" />;
}`
  },
  {
    feature: "AI Chat Assistant",
    freeService: "Google AI Studio (Gemini API)",
    purpose: "Utilize state-of-the-art models for translation, smart replies, summaries, and assistants.",
    icon: "Cpu",
    category: "AI",
    implementationGuide: `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function respondToUser(chatHistory, newMessage) {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [...chatHistory, { role: "user", parts: [{ text: newMessage }] }],
    config: {
      systemInstruction: "You are Linky, an AI Assistant on Geochat Link. Help the user."
    }
  });
  return response.text;
}`
  }
];

export const INITIAL_NEARBY_USERS: NearbyUser[] = [
  {
    id: "user-1",
    name: "Aarav Sharma",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=aarav",
    distance: 0.7,
    interests: ["coding", "cricket", "music"],
    bio: "Fullstack developer during the day, cricket enthusiast on weekends. Down to grab coffee or code at a local cafe!",
    status: "none",
    online: true
  },
  {
    id: "user-2",
    name: "Sofia Rodriguez",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=sofia",
    distance: 1.4,
    interests: ["photography", "music", "study"],
    bio: "Always scouting for architectural spots to photograph. Love ambient acoustic music. Let's study together or do a photo-walk!",
    status: "received",
    online: true
  },
  {
    id: "user-3",
    name: "Liam O'Connor",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=liam",
    distance: 2.8,
    interests: ["coding", "photography"],
    bio: "Systems architect. Interested in film photography and machine learning. Ask me about low-level programming!",
    status: "accepted",
    online: true
  },
  {
    id: "user-4",
    name: "Chloe Chen",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=chloe",
    distance: 4.1,
    interests: ["study", "music"],
    bio: "Undergrad studying biochemistry. Finding focus partners. Big fan of indie pop and warm lofi vibes.",
    status: "sent",
    online: false
  },
  {
    id: "user-5",
    name: "Mia Patel",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=mia",
    distance: 5.0,
    interests: ["cricket", "photography", "study"],
    bio: "Literature major. Photography blogger. Loves chatting about sports and history. Let's connect!",
    status: "none",
    online: false
  }
];

export const INITIAL_COMMUNITIES: LocalCommunity[] = [
  {
    id: "comm-1",
    name: "Metro Coding Hub",
    category: "coding",
    membersCount: 142,
    description: "Weekly co-working sessions, developer hackathons, and tech talks in the central district.",
    distance: 1.2,
    icon: "Code"
  },
  {
    id: "comm-2",
    name: "Over-the-Wicket Club",
    category: "cricket",
    membersCount: 89,
    description: "Casual local box cricket tournaments and live match screenings.",
    distance: 2.5,
    icon: "Trophy"
  },
  {
    id: "comm-3",
    name: "Golden Hour Photo Walk",
    category: "photography",
    membersCount: 65,
    description: "Weekly photography walks and image critique sessions. Open to amateurs and pros alike.",
    distance: 3.1,
    icon: "Camera"
  },
  {
    id: "comm-4",
    name: "Study Focus Lab",
    category: "study",
    membersCount: 204,
    description: "Silent study spaces, focus buddies, and study groups sharing materials and tips.",
    distance: 0.9,
    icon: "BookOpen"
  }
];

export const INTERESTS_LIST = [
  { id: "coding", name: "Coding", icon: "Code", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { id: "cricket", name: "Cricket", icon: "Trophy", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { id: "photography", name: "Photography", icon: "Camera", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { id: "music", name: "Music", icon: "Music", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { id: "study", name: "Study", icon: "BookOpen", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" }
];
