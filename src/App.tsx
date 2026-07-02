import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, Database, MessageSquare, Server, Globe, Image, PhoneCall, 
  Map, Compass, Bell, User, Cpu, Code, Trophy, Camera, Music, BookOpen, 
  Send, Shield, CheckCircle, Copy, Check, Users, MessageCircle, AlertCircle, 
  Volume2, Video, PhoneOff, MicOff, Mic, Smile, Paperclip, Trash2, Languages,
  ChevronRight, Sparkles, Play, Square, Info, RefreshCw, X, Palette, Clock, Film, Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StackFeature, ChatMessage, NearbyUser, CallState } from "./types";
import { STACK_FEATURES, INITIAL_NEARBY_USERS, INITIAL_COMMUNITIES, INTERESTS_LIST } from "./data";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  serverTimestamp,
  deleteDoc,
  getDocs,
  updateDoc
} from "firebase/firestore";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { AuthScreen } from "./components/AuthScreen";
import { LocalCommunity } from "./types";

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyCfoqz83kbNihY4k6MRb1x7TiwJauN1F8E",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "extended-ether-x2t1j.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "extended-ether-x2t1j",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "extended-ether-x2t1j.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "361310188864",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:361310188864:web:0a3d6c97c01d4551caf6a5"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = (import.meta as any).env.VITE_FIREBASE_DATABASE_ID 
  ? getFirestore(firebaseApp, (import.meta as any).env.VITE_FIREBASE_DATABASE_ID)
  : ((import.meta as any).env.VITE_FIREBASE_PROJECT_ID 
      ? getFirestore(firebaseApp)
      : getFirestore(firebaseApp, "ai-studio-chatstackworkspa-a4f85a62-eb6f-4c5c-9808-6b19be2ce1ba")
    );
const auth = getAuth(firebaseApp);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return Number(d.toFixed(1));
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"developer" | "app_demo">("app_demo");

  // ----------------------------------------------------
  // DEVELOPER HUB STATES
  // ----------------------------------------------------
  const [selectedFeature, setSelectedFeature] = useState<StackFeature>(STACK_FEATURES[2]); // Default Socket.IO
  const [copiedCode, setCopiedCode] = useState(false);
  const [checklist, setChecklist] = useState({
    login: true,
    private: true,
    group: false,
    onlineStatus: true,
    typing: true,
    voiceCalls: false,
    nearby: false,
    aiAssistant: true,
    translation: true,
  });

  // ----------------------------------------------------
  // GEOCAT APP DEMO STATES
  // ----------------------------------------------------
  const [myProfile, setMyProfile] = useState<{
    id: string;
    name: string;
    avatarSeed: string;
    interests: string[];
    bio: string;
    latitude: number;
    longitude: number;
  }>(() => {
    const saved = localStorage.getItem("geochat_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) return parsed;
      } catch (e) {}
    }
    const randId = `user_${Math.random().toString(36).substring(2, 9)}`;
    const newProfile = {
      id: randId,
      name: "User_" + Math.floor(1000 + Math.random() * 9000),
      avatarSeed: "avatar_" + Math.floor(Math.random() * 1000),
      interests: ["coding", "music"],
      bio: "Active member searching for cool people nearby!",
      latitude: 37.7749 + (Math.random() - 0.5) * 0.05,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.05,
    };
    localStorage.setItem("geochat_profile", JSON.stringify(newProfile));
    return newProfile;
  });

  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [communities, setCommunities] = useState<LocalCommunity[]>([]);

  const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${myProfile.avatarSeed}`;
  
  // Geolocation and filters
  const [searchRadius, setSearchRadius] = useState<number>(5); // Default 5 km
  const [activeInterestFilter, setActiveInterestFilter] = useState<string>("all");
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  
  // Custom communities state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommName, setNewCommName] = useState("");
  const [newCommCategory, setNewCommCategory] = useState("coding");
  const [newCommDescription, setNewCommDescription] = useState("");
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);
  
  // Dynamic User database (synchronized from Firestore in real-time)
  const [nearbyPeople, setNearbyPeople] = useState<NearbyUser[]>([]);
  const [connectionsData, setConnectionsData] = useState<{ [userId: string]: { status: string; senderId: string; receiverId: string; connectionId: string } }>({});
  
  // Active Chat and Conversations
  const [activeChatId, setActiveChatId] = useState<string>("ai-assistant");
  const [conversations, setConversations] = useState<{ [id: string]: ChatMessage[] }>({
    "ai-assistant": [
      {
        id: "ai-welcome",
        senderId: "ai-assistant",
        senderName: "Linky AI",
        senderAvatar: "🤖",
        text: "Hi there! I am Linky, your server-side Gemini AI Chat Assistant. Ask me anything, or click any message to instantly translate it into another language! 🚀",
        timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "text",
      }
    ]
  });

  // Chat controls
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiIsResponding, setAiIsResponding] = useState(false);
  const [translationLanguages] = useState([
    { code: "es", name: "Spanish 🇪🇸" },
    { code: "fr", name: "French 🇫🇷" },
    { code: "ja", name: "Japanese 🇯🇵" },
    { code: "hi", name: "Hindi 🇮🇳" },
    { code: "de", name: "German 🇩🇪" },
  ]);
  const [selectedTranslationLang, setSelectedTranslationLang] = useState("es");
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Recording (Voice Message Simulation)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Call System
  const [callState, setCallState] = useState<CallState>({ type: "none", status: "idle" });
  const [callDuration, setCallDuration] = useState(0);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Status Alerts
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // ----------------------------------------------------
  // ADDITIONAL USER-REQUESTED MODULES (GEOLOCATING, SUMMARIES, GIFS, SMART REPLIES, THEMES)
  // ----------------------------------------------------
  const [userLocatedArea, setUserLocatedArea] = useState<string>("Central District, Metro City");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  
  const [activeSummary, setActiveSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  
  const [gifSearchOpen, setGifSearchOpen] = useState<boolean>(false);
  const [gifSearchQuery, setGifSearchQuery] = useState<string>("");
  const [gifSearchType, setGifSearchType] = useState<"gifs" | "stickers">("gifs");
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState<boolean>(false);
  
  const [suggestedReplies, setSuggestedReplies] = useState<{ [chatId: string]: string[] }>({});
  const [loadingSmartReplies, setLoadingSmartReplies] = useState<boolean>(false);
  
  const [themeSettingsOpen, setThemeSettingsOpen] = useState<boolean>(false);
  const [customTheme, setCustomTheme] = useState({
    themeId: "slate", // "slate" | "cyberpunk" | "sunset" | "lavender"
    primaryColor: "#2563EB",
    bgPreset: "solid", // "solid" | "pattern" | "custom"
    chatWallpaper: "",
  });

  const PREDEFINED_THEMES = [
    { id: "slate", name: "Professional Slate", primary: "#2563EB", bg: "bg-[#F8FAFC]", text: "text-[#1E293B]", cardBg: "bg-white", border: "border-[#E2E8F0]" },
    { id: "cyberpunk", name: "Midnight Cyberpunk", primary: "#06B6D4", bg: "bg-[#090D16]", text: "text-slate-100", cardBg: "bg-[#0F172A]", border: "border-slate-800" },
    { id: "sunset", name: "Warm Sunset", primary: "#F97316", bg: "bg-[#FFFBEB]", text: "text-[#431407]", cardBg: "bg-white", border: "border-[#FED7AA]" },
    { id: "lavender", name: "Electric Lavender", primary: "#8B5CF6", bg: "bg-[#FAF5FF]", text: "text-[#2E1065]", cardBg: "bg-white", border: "border-[#F5D0FE]" }
  ];

  const currentThemeConfig = PREDEFINED_THEMES.find(t => t.id === customTheme.themeId) || PREDEFINED_THEMES[0];

  // 1. Firebase Authentication State Change Listener
  useEffect(() => {
    if (!db) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [db]);

  // 2. Sync logged-in user's profile from Firestore `users` collection in real-time
  useEffect(() => {
    if (!db || !authUser) return;
    const userRef = doc(db, "users", authUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyProfile({
          id: authUser.uid,
          name: data.name || "User",
          avatarSeed: data.avatarSeed || "user",
          interests: data.interests || [],
          bio: data.bio || "Active Geochat member",
          latitude: data.latitude || 37.7749,
          longitude: data.longitude || -122.4194
        });
        if (data.joinedCommunities) {
          setJoinedCommunities(data.joinedCommunities);
        }
      } else {
        // Document doesn't exist yet, wait for AuthScreen to create it, or create fallback
        const fallbackProfile = {
          id: authUser.uid,
          name: authUser.displayName || authUser.email?.split("@")[0] || "User",
          avatarSeed: "user",
          interests: ["coding", "music"],
          bio: "Active Geochat member",
          latitude: 37.7749,
          longitude: -122.4194
        };
        setDoc(userRef, {
          ...fallbackProfile,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=user`,
          online: true,
          lastActive: serverTimestamp()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${authUser.uid}`));
      }
      setAuthLoading(false);
    }, (err) => {
      setAuthLoading(false);
      handleFirestoreError(err, OperationType.GET, `users/${authUser.uid}`);
    });

    return () => unsubscribe();
  }, [db, authUser]);

  // 3. Heartbeat & Online status keeper
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const interval = setInterval(() => {
      const userRef = doc(db, "users", myProfile.id);
      updateDoc(userRef, {
        lastActive: serverTimestamp(),
        online: true
      }).catch(err => console.error("Heartbeat failed:", err));
    }, 30000); // 30s heartbeat

    return () => clearInterval(interval);
  }, [db, myProfile.id, authUser]);

  // 4. Seeding initial users and communities if database is empty
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const checkAndSeedDB = async () => {
      try {
        // No longer seeding fake bot profiles. Only real users are loaded and displayed.

        const qComm = query(collection(db, "communities"));
        const snapComm = await getDocs(qComm);
        if (snapComm.size === 0) {
          triggerAlert("Seeding database with local communities...", "info");
          for (const comm of INITIAL_COMMUNITIES) {
            let latOffset = 0;
            let lonOffset = 0;
            if (comm.id === "comm-1") { latOffset = 0.008; lonOffset = 0.007; }
            else if (comm.id === "comm-2") { latOffset = -0.015; lonOffset = 0.012; }
            else if (comm.id === "comm-3") { latOffset = 0.022; lonOffset = -0.021; }
            else if (comm.id === "comm-4") { latOffset = -0.005; lonOffset = -0.006; }

            const commRef = doc(db, "communities", comm.id);
            await setDoc(commRef, {
              id: comm.id,
              name: comm.name,
              category: comm.category,
              description: comm.description,
              icon: comm.icon,
              membersCount: comm.membersCount,
              latitude: (myProfile.latitude || 37.7749) + latOffset,
              longitude: (myProfile.longitude || -122.4194) + lonOffset
            });
          }
        }
      } catch (err) {
        console.error("Database seeding failed:", err);
        handleFirestoreError(err, OperationType.WRITE, "seeding");
      }
    };

    checkAndSeedDB();
  }, [db, myProfile.id, myProfile.latitude, myProfile.longitude, authUser]);

  // 5. Real-time Listener for Communities with physical distance calculations
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const q = query(collection(db, "communities"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LocalCommunity[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const dist = calculateDistance(
          myProfile.latitude || 37.7749,
          myProfile.longitude || -122.4194,
          data.latitude || 37.7749,
          data.longitude || -122.4194
        );
        list.push({
          id: data.id,
          name: data.name,
          category: data.category,
          description: data.description,
          icon: data.icon,
          membersCount: data.membersCount || 10,
          distance: dist
        });
      });
      setCommunities(list);
    }, (err) => {
      console.error("Communities snapshot listener error:", err);
      handleFirestoreError(err, OperationType.GET, "communities");
    });

    return () => unsubscribe();
  }, [db, myProfile.latitude, myProfile.longitude, myProfile.id, authUser]);

  // 6. Real-time Listener for Connections/Invitations involving this user
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const q = query(collection(db, "connections"), where("members", "array-contains", myProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const connMap: { [userId: string]: { status: string; senderId: string; receiverId: string; connectionId: string } } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const otherUserId = data.members.find((m: string) => m !== myProfile.id);
        if (otherUserId) {
          connMap[otherUserId] = {
            status: data.status,
            senderId: data.senderId,
            receiverId: data.receiverId,
            connectionId: doc.id
          };
        }
      });
      setConnectionsData(connMap);
    }, (err) => {
      console.error("Connections snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, "connections");
    });
    return () => unsubscribe();
  }, [db, myProfile.id, authUser]);

  // 3. Real-time Listener for ALL Users in Firestore
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: NearbyUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id !== myProfile.id && !data.id.startsWith("user-")) {
          const dist = calculateDistance(
            myProfile.latitude || 37.7749,
            myProfile.longitude || -122.4194,
            data.latitude || 37.7749,
            data.longitude || -122.4194
          );
          
          let status: "none" | "sent" | "received" | "accepted" = "none";
          const conn = connectionsData[data.id];
          if (conn) {
            if (conn.status === "accepted") {
              status = "accepted";
            } else if (conn.status === "pending") {
              status = conn.senderId === myProfile.id ? "sent" : "received";
            }
          }

          usersList.push({
            id: data.id,
            name: data.name,
            avatar: data.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.id}`,
            distance: dist,
            interests: data.interests || [],
            bio: data.bio || "",
            status: status,
            online: data.online !== false,
            typing: data.typing === myProfile.id
          });
        }
      });
      setNearbyPeople(usersList);
    }, (err) => {
      console.error("Users snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, "users");
    });
    return () => unsubscribe();
  }, [db, myProfile.id, myProfile.latitude, myProfile.longitude, connectionsData, authUser]);

  // 4. Real-time Listener for the active Chat Session's messages
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    if (activeChatId === "ai-assistant") return;
    
    const isCommunity = activeChatId.startsWith("comm-");
    
    let q;
    if (isCommunity) {
      q = query(
        collection(db, "communities", activeChatId, "messages"),
        orderBy("timestamp", "asc")
      );
    } else {
      const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
      q = query(
        collection(db, "connections", connectionId, "messages"),
        orderBy("timestamp", "asc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let timeStr = "";
        if (data.timestamp) {
          const date = data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000) : new Date(data.timestamp);
          timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        msgs.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          text: data.text,
          timestamp: timeStr,
          type: data.type || "text",
          mediaUrl: data.mediaUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          translation: data.translation,
          originalText: data.originalText,
          reactions: data.reactions || {}
        });
      });

      setConversations(prev => ({
        ...prev,
        [activeChatId]: msgs
      }));
    }, (err) => {
      console.error("Messages snapshot error:", err);
      const isCommunity = activeChatId.startsWith("comm-");
      const path = isCommunity ? `communities/${activeChatId}/messages` : `connections/${myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`}/messages`;
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [db, activeChatId, myProfile.id, authUser]);

  // Typing indicator publisher
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const userRef = doc(db, "users", myProfile.id);
    
    if (messageInput.length > 0 && activeChatId !== "ai-assistant" && !activeChatId.startsWith("comm-")) {
      updateDoc(userRef, { typing: activeChatId }).catch(e => console.error(e));
      
      const timeout = setTimeout(() => {
        updateDoc(userRef, { typing: "" }).catch(e => console.error(e));
      }, 3000);
      return () => clearTimeout(timeout);
    } else {
      updateDoc(userRef, { typing: "" }).catch(e => console.error(e));
    }
  }, [messageInput, activeChatId, db, authUser, myProfile.id]);

  // Browser Geolocation & Nominatim Reverse Geocoding API
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      triggerAlert("Geolocation is not supported by your browser.", "error");
      return;
    }
    setIsLocating(true);
    triggerAlert("Requesting browser GPS coordinates...", "info");
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14`);
          if (!response.ok) throw new Error("Nominatim request failed");
          const data = await response.json();
          
          const address = data.address || {};
          const suburb = address.suburb || address.neighbourhood || address.residential || address.village || "";
          const city = address.city || address.town || address.state || "";
          const country = address.country || "";
          const areaName = [suburb, city, country].filter(Boolean).join(", ") || data.display_name || "Approximate Location";
          
          setUserLocatedArea(areaName);
          triggerAlert(`Located successfully near ${areaName}!`, "success");
          
          setMyProfile(prev => ({
            ...prev,
            latitude,
            longitude
          }));
        } catch (err) {
          console.error("Nominatim reverse geocoding failed, using coordinates:", err);
          setUserLocatedArea(`Located near ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
          triggerAlert("Successfully located! Detailed neighborhood lookup timed out.", "success");
          
          setMyProfile(prev => ({
            ...prev,
            latitude,
            longitude
          }));
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);
        triggerAlert("Could not obtain GPS permission. Using simulated district location.", "info");
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  // Conversation Summarizer logic
  const handleSummarizeConversation = async () => {
    const chatMsgs = conversations[activeChatId] || [];
    if (chatMsgs.length === 0) {
      triggerAlert("There are no messages in this conversation to summarize.", "info");
      return;
    }
    
    setIsSummarizing(true);
    try {
      const messagesPayload = chatMsgs.map(m => ({
        senderName: m.senderId === "me" ? myProfile.name : m.senderName,
        text: m.text
      }));
      
      const res = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesPayload })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setActiveSummary(data.summary || "No summary was returned.");
      triggerAlert("Conversation summarized using Gemini AI!", "success");
    } catch (err: any) {
      console.error("Summarization failed:", err);
      triggerAlert(`Failed to generate summary: ${err.message}`, "error");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Smart Reply generation
  const handleFetchSmartReplies = async (chatId: string, msgs: ChatMessage[]) => {
    if (msgs.length === 0 || chatId === "ai-assistant") {
      setSuggestedReplies(prev => ({ ...prev, [chatId]: [] }));
      return;
    }
    
    setLoadingSmartReplies(true);
    try {
      const messagesPayload = msgs.map(m => ({
        senderName: m.senderId === "me" ? myProfile.name : m.senderName,
        text: m.text
      }));
      
      const res = await fetch("/api/gemini/smart-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesPayload })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (Array.isArray(data.replies)) {
        setSuggestedReplies(prev => ({ ...prev, [chatId]: data.replies }));
      }
    } catch (err) {
      console.warn("Could not fetch smart replies:", err);
    } finally {
      setLoadingSmartReplies(false);
    }
  };

  // GIPHY & Tenor GIF Search API logic
  const handleSearchGifs = async (query: string, type: "gifs" | "stickers") => {
    setGifLoading(true);
    try {
      const res = await fetch(`/api/giphy-tenor/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (!res.ok) throw new Error("GIPHY/Tenor search route failed");
      const data = await res.json();
      if (Array.isArray(data.results)) {
        setGifResults(data.results);
      }
    } catch (err) {
      console.error("Error searching animations:", err);
    } finally {
      setGifLoading(false);
    }
  };

  // Effect to automatically search GIFs/stickers
  useEffect(() => {
    if (gifSearchOpen) {
      handleSearchGifs(gifSearchQuery, gifSearchType);
    }
  }, [gifSearchOpen, gifSearchQuery, gifSearchType]);

  // Effect to generate smart replies when new messages arrive
  useEffect(() => {
    const currentMsgs = conversations[activeChatId] || [];
    if (currentMsgs.length > 0) {
      const lastMsg = currentMsgs[currentMsgs.length - 1];
      if (lastMsg && lastMsg.senderId !== "me") {
        handleFetchSmartReplies(activeChatId, currentMsgs);
      } else {
        setSuggestedReplies(prev => ({ ...prev, [activeChatId]: [] }));
      }
    } else {
      setSuggestedReplies(prev => ({ ...prev, [activeChatId]: [] }));
    }
  }, [activeChatId, conversations[activeChatId]?.length]);

  // Profile setup synchronizer is now computed inline dynamically via avatarUrl

  // Handle Voice Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecording]);

  // Handle Call Timer and Camera stream
  useEffect(() => {
    if (callState.status === "connected") {
      setCallDuration(0);
      callIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Attempt to access user camera if video call
      if (callState.type === "video") {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => {
            console.warn("Could not access camera/mic for video call. Using placeholder.", err);
            triggerAlert("Could not access camera. Using call avatar preview.", "info");
          });
      }
    } else {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
    return () => {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    };
  }, [callState.status]);

  // Alert triggers
  const triggerAlert = (text: string, type: "success" | "info" | "error" = "info") => {
    setAlertMsg({ text, type });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4000);
  };

  // Copy helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    triggerAlert("Code snippet copied to clipboard!", "success");
  };

  // Toggle user interests
  const handleInterestToggle = (interestId: string) => {
    const updated = myProfile.interests.includes(interestId)
      ? myProfile.interests.filter(i => i !== interestId)
      : [...myProfile.interests, interestId];
    
    setMyProfile(prev => ({ ...prev, interests: updated }));
    triggerAlert(`Updated your interests profile. Radar matching updated.`, "success");
  };

  // Synchronize local profile edits to Cloud Firestore
  const handleSaveProfile = async () => {
    if (!db || !myProfile.id) return;
    try {
      const userRef = doc(db, "users", myProfile.id);
      await setDoc(userRef, {
        name: myProfile.name,
        avatarSeed: myProfile.avatarSeed,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${myProfile.avatarSeed}`,
        interests: myProfile.interests,
        bio: myProfile.bio || ""
      }, { merge: true });
      triggerAlert("Profile successfully synchronized to Cloud Firestore!", "success");
    } catch (err) {
      console.error("Save profile failed:", err);
      triggerAlert("Failed to save profile details to Cloud Firestore.", "error");
    }
  };

  // Radians to match people dynamically
  const filteredPeople = nearbyPeople.filter(person => {
    // Distance check
    if (person.distance > searchRadius) return false;
    // Interest filter check
    if (activeInterestFilter !== "all" && !person.interests.includes(activeInterestFilter)) {
      return false;
    }
    return true;
  });

  const filteredCommunities = communities.filter(comm => {
    if (comm.distance > searchRadius) return false;
    if (activeInterestFilter !== "all" && comm.category !== activeInterestFilter) return false;
    return true;
  });

  const receivedRequests = Object.entries(connectionsData)
    .filter(([_, conn]) => {
      const c = conn as { status: string; senderId: string; receiverId: string; connectionId: string };
      return c.status === "pending" && c.receiverId === myProfile.id;
    })
    .map(([otherUserId, conn]) => {
      const c = conn as { status: string; senderId: string; receiverId: string; connectionId: string };
      const person = nearbyPeople.find(p => p.id === otherUserId);
      return {
        userId: otherUserId,
        name: person?.name || "Someone Nearby",
        avatar: person?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${otherUserId}`,
        ...c
      };
    });

  // Dynamic user reactions
  const handleReaction = (messageId: string, emoji: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    const updated = chatMsgs.map(m => {
      if (m.id === messageId) {
        const r = { ...(m.reactions || {}) };
        r[emoji] = (r[emoji] || 0) + 1;
        return { ...m, reactions: r };
      }
      return m;
    });
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));
  };

  // Send Message logic (supports Gemini AI Assistant and generic nearby chatting simulation)
  const handleSendMessage = async (customText?: string, type: "text" | "image" | "file" | "audio" = "text", fileData?: { name: string; size: string; url: string }) => {
    const textToSend = customText !== undefined ? customText : messageInput;
    if (!textToSend.trim() && !fileData) return;

    if (customText === undefined) {
      setMessageInput("");
    }

    // Handle interactive dynamic replies
    if (activeChatId === "ai-assistant") {
      const newMessageId = `msg-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: newMessageId,
        senderId: "me",
        senderName: myProfile.name,
        senderAvatar: avatarUrl,
        text: type === "text" ? textToSend : (fileData ? `Sent ${fileData.name}` : "Voice message"),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type,
      };

      if (type === "image" && fileData) {
        userMessage.mediaUrl = fileData.url;
      } else if (type === "file" && fileData) {
        userMessage.fileName = fileData.name;
        userMessage.fileSize = fileData.size;
      } else if (type === "audio" && fileData) {
        userMessage.mediaUrl = fileData.url;
      }

      // Append to conversation
      const currentChatMsgs = conversations["ai-assistant"] || [];
      setConversations(prev => ({
        ...prev,
        "ai-assistant": [...currentChatMsgs, userMessage]
      }));

      setAiIsResponding(true);
      try {
        // Construct standard context history for the API route
        const historyContext = currentChatMsgs.map(msg => ({
          role: msg.senderId === "me" ? "user" : "model",
          text: msg.text
        }));

        const response = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: textToSend,
            history: historyContext
          })
        });

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        const aiMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          senderId: "ai-assistant",
          senderName: "Linky AI",
          senderAvatar: "🤖",
          text: data.text || "I was unable to formulate a response.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: "text"
        };

        setConversations(prev => ({
          ...prev,
          "ai-assistant": [...(prev["ai-assistant"] || []), aiMessage]
        }));
      } catch (err: any) {
        console.error("Failed to query server Gemini endpoint:", err);
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          senderId: "ai-assistant",
          senderName: "System Warning",
          senderAvatar: "⚠️",
          text: `Could not connect to the Gemini API endpoint. (Reason: ${err.message || "Endpoint offline"}). This is expected if the local dev server is starting up. Check your API Key configuration under Secrets!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: "text"
        };
        setConversations(prev => ({
          ...prev,
          "ai-assistant": [...(prev["ai-assistant"] || []), errorMessage]
        }));
      } finally {
        setAiIsResponding(false);
      }
    } else {
      // Send message to real user connection or community channel in Firestore
      if (!db) return;
      try {
        const isCommunity = activeChatId.startsWith("comm-");
        const textValue = type === "text" ? textToSend : (fileData ? `Sent ${fileData.name}` : "Voice message");
        const msgPayload: any = {
          senderId: myProfile.id,
          senderName: myProfile.name,
          senderAvatar: avatarUrl,
          text: textValue,
          timestamp: serverTimestamp(),
          type
        };

        if (type === "image" && fileData) {
          msgPayload.mediaUrl = fileData.url;
        } else if (type === "file" && fileData) {
          msgPayload.fileName = fileData.name;
          msgPayload.fileSize = fileData.size;
        } else if (type === "audio" && fileData) {
          msgPayload.mediaUrl = fileData.url;
        }

        if (isCommunity) {
          await addDoc(collection(db, "communities", activeChatId, "messages"), msgPayload);
        } else {
          const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
          await addDoc(collection(db, "connections", connectionId, "messages"), msgPayload);

          // Update the connection doc's updatedAt
          await setDoc(doc(db, "connections", connectionId), {
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.error("Failed to send message to Firestore:", err);
        triggerAlert("Failed to send message.", "error");
      }
    }
  };

  // Instant Translate using server-side Gemini endpoint
  const handleTranslateMessage = async (msgId: string, text: string) => {
    setTranslatingMsgId(msgId);
    try {
      const response = await fetch("/api/gemini/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          targetLanguage: translationLanguages.find(l => l.code === selectedTranslationLang)?.name || "Spanish"
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Update message with translation
      const chatMsgs = conversations[activeChatId] || [];
      const updated = chatMsgs.map(m => {
        if (m.id === msgId) {
          return { ...m, translation: data.translation, originalText: text };
        }
        return m;
      });

      setConversations(prev => ({ ...prev, [activeChatId]: updated }));
      triggerAlert("Message translated successfully via Gemini AI!", "success");
    } catch (err: any) {
      console.error("Translation Error:", err);
      triggerAlert(`Could not translate: ${err.message}`, "error");
    } finally {
      setTranslatingMsgId(null);
    }
  };

  // Revert/hide translation
  const handleHideTranslation = (msgId: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    const updated = chatMsgs.map(m => {
      if (m.id === msgId) {
        const copy = { ...m };
        delete copy.translation;
        delete copy.originalText;
        return copy;
      }
      return m;
    });
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));
  };

  // Firestore Connection Requests
  const handleSendRequest = async (userId: string) => {
    if (!db) return;
    try {
      const connectionId = myProfile.id < userId ? `${myProfile.id}_${userId}` : `${userId}_${myProfile.id}`;
      await setDoc(doc(db, "connections", connectionId), {
        id: connectionId,
        members: [myProfile.id, userId],
        senderId: myProfile.id,
        receiverId: userId,
        status: "pending",
        updatedAt: serverTimestamp()
      });
      triggerAlert("Chat invitation sent! Real-time connection pending.", "success");
    } catch (err) {
      console.error("Failed to send chat invitation:", err);
      triggerAlert("Failed to send invitation.", "error");
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    if (!db) return;
    try {
      const connectionId = myProfile.id < userId ? `${myProfile.id}_${userId}` : `${userId}_${myProfile.id}`;
      await setDoc(doc(db, "connections", connectionId), {
        status: "accepted",
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Check if messages already exist. If not, add a friendly welcome message!
      const msgsRef = collection(db, "connections", connectionId, "messages");
      const msgsSnap = await getDocs(msgsRef);
      if (msgsSnap.empty) {
        await addDoc(msgsRef, {
          senderId: userId,
          senderName: nearbyPeople.find(p => p.id === userId)?.name || "User",
          senderAvatar: nearbyPeople.find(p => p.id === userId)?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
          text: "Hey! Thanks for accepting my request. Glad we share some interests! Let's chat. 🙌",
          timestamp: serverTimestamp(),
          type: "text"
        });
      }

      triggerAlert("Invitation accepted! You are now connected in real-time.", "success");
    } catch (err) {
      console.error("Failed to accept invitation:", err);
      triggerAlert("Failed to accept invitation.", "error");
    }
  };

  const handleDeclineRequest = async (userId: string) => {
    if (!db) return;
    try {
      const connectionId = myProfile.id < userId ? `${myProfile.id}_${userId}` : `${userId}_${myProfile.id}`;
      await deleteDoc(doc(db, "connections", connectionId));
      triggerAlert("Invitation declined.", "info");
    } catch (err) {
      console.error("Failed to decline request:", err);
    }
  };

  const handleJoinCommunity = async (commId: string) => {
    if (!db || !authUser || !myProfile.id) return;
    const userRef = doc(db, "users", myProfile.id);
    const updated = joinedCommunities.includes(commId)
      ? joinedCommunities.filter(c => c !== commId)
      : [...joinedCommunities, commId];
      
    setJoinedCommunities(updated);
    try {
      await updateDoc(userRef, {
        joinedCommunities: updated
      });
      if (joinedCommunities.includes(commId)) {
        triggerAlert("Left community channel.", "info");
      } else {
        triggerAlert("Joined local interest community! You can now view public group feeds.", "success");
      }
    } catch (err) {
      console.error("Failed to update joined communities in Firestore:", err);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !authUser) return;
    if (!newCommName.trim()) {
      triggerAlert("Community name is required.", "error");
      return;
    }
    try {
      const newId = `comm-${Date.now()}`;
      
      let icon = "BookOpen";
      if (newCommCategory === "coding") icon = "Code";
      else if (newCommCategory === "cricket") icon = "Trophy";
      else if (newCommCategory === "photography") icon = "Camera";
      else if (newCommCategory === "music") icon = "Music";
      
      const commRef = doc(db, "communities", newId);
      const payload = {
        id: newId,
        name: newCommName.trim(),
        category: newCommCategory,
        description: newCommDescription.trim() || `Local community for ${newCommCategory} lovers in this area.`,
        icon: icon,
        membersCount: 1,
        latitude: myProfile.latitude || 37.7749,
        longitude: myProfile.longitude || -122.4194,
        createdBy: authUser.uid,
        createdAt: serverTimestamp()
      };

      await setDoc(commRef, payload);
      
      const userRef = doc(db, "users", myProfile.id);
      const updated = [...joinedCommunities, newId];
      setJoinedCommunities(updated);
      await updateDoc(userRef, {
        joinedCommunities: updated
      });

      setNewCommName("");
      setNewCommDescription("");
      setShowCreateCommunity(false);
      triggerAlert(`Community "${payload.name}" created successfully at your local coordinates!`, "success");
    } catch (err) {
      console.error("Failed to create community:", err);
      handleFirestoreError(err, OperationType.WRITE, "communities");
    }
  };

  // Mock File Upload Simulator
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerAlert(`Selected: ${file.name}. Simulating Cloudinary free-tier upload...`, "info");
    
    // Simulate upload delay
    setTimeout(() => {
      const mockUrl = file.type.startsWith("image/") 
        ? URL.createObjectURL(file) 
        : "";
      
      const fileData = {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        url: mockUrl
      };

      const fileType = file.type.startsWith("image/") ? "image" : "file";
      handleSendMessage("", fileType, fileData);
      triggerAlert("Uploaded and shared file successfully!", "success");
    }, 1500);
  };

  // Simulate audio voice notes
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // Simulate sending the audio file
      triggerAlert("Voice note recorded! Transcribing and sharing with peer...", "success");
      const fakeVoiceData = {
        name: `voice-note-${Date.now()}.mp3`,
        size: "0.24 MB",
        url: "#" // Waveform simulated
      };
      handleSendMessage("", "audio", fakeVoiceData);
    } else {
      setIsRecording(true);
      triggerAlert("Microphone active. Recording your voice note...", "info");
    }
  };

  // Initiate calls
  const startCall = (type: "voice" | "video") => {
    const activeContact = nearbyPeople.find(p => p.id === activeChatId);
    if (!activeContact && activeChatId !== "ai-assistant") return;

    const name = activeChatId === "ai-assistant" ? "Linky AI" : (activeContact?.name || "User");
    const avatar = activeChatId === "ai-assistant" ? "🤖" : (activeContact?.avatar || "👤");

    setCallState({
      type,
      status: "ringing",
      partnerId: activeChatId,
      partnerName: name,
      partnerAvatar: avatar
    });

    triggerAlert(`Initiating WebRTC peer path. Ringing ${name}...`, "info");

    // Connect after 2.5 seconds
    setTimeout(() => {
      setCallState(prev => ({ ...prev, status: "connected" }));
      triggerAlert(`WebRTC peer-to-peer connection established securely!`, "success");
    }, 2500);
  };

  const endCall = () => {
    setCallState({ type: "none", status: "idle" });
    triggerAlert("Call hung up.", "info");
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    const updated = chatMsgs.filter(m => m.id !== msgId);
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));
    triggerAlert("Message deleted.", "info");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center font-sans">
        <AnimatePresence>
          {alertMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all max-w-md bg-white text-slate-800 border-[#E2E8F0]"
              id="alert-banner"
            >
              {alertMsg.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              {alertMsg.type === "info" && <Sparkles className="w-4 h-4 text-[#2563EB] font-bold animate-pulse" />}
              {alertMsg.type === "error" && <AlertCircle className="w-4 h-4 text-rose-500" />}
              <span>{alertMsg.text}</span>
              <button onClick={() => setAlertMsg(null)} className="ml-2 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing Secure Handshake...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-[#1E293B] flex flex-col font-sans">
        <AnimatePresence>
          {alertMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all max-w-md bg-white text-slate-800 border-[#E2E8F0]"
              id="alert-banner"
            >
              {alertMsg.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              {alertMsg.type === "info" && <Sparkles className="w-4 h-4 text-[#2563EB] font-bold animate-pulse" />}
              {alertMsg.type === "error" && <AlertCircle className="w-4 h-4 text-rose-500" />}
              <span>{alertMsg.text}</span>
              <button onClick={() => setAlertMsg(null)} className="ml-2 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <header className="bg-[#0F172A] border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm border border-slate-700">
              <Compass className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Geochat Link <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase tracking-wider border border-emerald-500/20">Real-Time Firestore & GPS</span>
              </h1>
              <p className="text-xs text-slate-400">Discover nearby people and communities matched by physical coordinates and mutual interests. Chat 100% in real-time.</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <AuthScreen auth={auth} db={db} onAuthSuccess={setAuthUser} triggerAlert={triggerAlert} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col font-sans transition-colors duration-300">
      
      {/* Dynamic Alert Banner */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all max-w-md bg-white text-slate-800 border-[#E2E8F0]"
            id="alert-banner"
          >
            {alertMsg.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            {alertMsg.type === "info" && <Sparkles className="w-4 h-4 text-[#2563EB] font-bold animate-pulse" />}
            {alertMsg.type === "error" && <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span>{alertMsg.text}</span>
            <button onClick={() => setAlertMsg(null)} className="ml-2 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Header */}
      <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm border border-slate-700">
            <Compass className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Geochat Link <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase tracking-wider border border-emerald-500/20">Real-Time Firestore & GPS</span>
            </h1>
            <p className="text-xs text-slate-400">Discover nearby people and communities matched by physical coordinates and mutual interests. Chat 100% in real-time.</p>
          </div>
        </div>

        {authUser && (
          <div className="flex items-center gap-3 relative shrink-0 self-end sm:self-auto">
            {/* Bell Icon & Notification Dropdown */}
            <div className="relative">
              <button
                id="btn-bell-notifications"
                onClick={() => setShowRequestsDropdown(prev => !prev)}
                className="p-2.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all relative cursor-pointer flex items-center justify-center shadow-sm"
              >
                <Bell className="w-4 h-4" />
                {receivedRequests.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-[#0F172A] animate-bounce">
                    {receivedRequests.length}
                  </span>
                )}
              </button>

              {/* Requests Dropdown */}
              <AnimatePresence>
                {showRequestsDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2.5 w-72 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-slate-800"
                  >
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Friend Requests ({receivedRequests.length})
                      </span>
                      {receivedRequests.length > 0 && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                          Pending Action
                        </span>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {receivedRequests.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-400 font-medium">
                          No pending requests
                        </div>
                      ) : (
                        receivedRequests.map((req) => (
                          <div key={req.userId} className="p-3.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors">
                            <img
                              src={req.avatar}
                              alt={req.name}
                              className="w-8 h-8 rounded-lg bg-slate-100 object-contain shrink-0 mt-0.5"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 truncate">{req.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Wants to connect with you</p>
                              
                              <div className="flex gap-1.5 mt-2.5">
                                <button
                                  id={`bell-accept-${req.userId}`}
                                  onClick={() => {
                                    handleAcceptRequest(req.userId);
                                    setShowRequestsDropdown(false);
                                  }}
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[9px] uppercase tracking-wider py-1.5 rounded transition-all cursor-pointer text-center"
                                >
                                  Accept
                                </button>
                                <button
                                  id={`bell-decline-${req.userId}`}
                                  onClick={() => {
                                    handleDeclineRequest(req.userId);
                                  }}
                                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-[9px] uppercase tracking-wider py-1.5 rounded transition-all cursor-pointer text-center"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl">
              <img 
                src={avatarUrl} 
                alt="My Profile avatar" 
                className="w-7 h-7 rounded bg-slate-950 object-contain"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider leading-none">Logged In As</span>
                <span className="text-xs font-black text-slate-100 block mt-1 leading-none">{myProfile.name}</span>
              </div>
              <button
                onClick={() => {
                  signOut(auth).then(() => {
                    triggerAlert("Signed out successfully from Geochat workspace.", "info");
                  });
                }}
                className="ml-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors font-bold text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Sections */}
      <main className="flex-1 overflow-x-hidden flex flex-col bg-[#0B0F19]">
        
        {/* ======================================================== */}
        {/* TAB 1: DEVELOPER BLUEPRINT & ARCHITECTURE GUIDE */}
        {/* ======================================================== */}
        <AnimatePresence mode="wait">
          {activeTab === "developer" && false && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in"
              id="developer-workspace"
            >
              {/* Stack Table Left Column */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Cost/Tier comparison banner with Promo Box Theme */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-[#1E40AF] rounded-lg text-white">
                      <Trophy className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#1E40AF] uppercase tracking-wider">Zero-Dollar Full-Stack Stack</h3>
                      <p className="text-xs text-[#1E293B] mt-1 max-w-xl leading-relaxed font-medium">
                        You can build, test, and host almost your entire real-time application using free quotas. Free layers from Firebase, MongoDB Atlas, Render, Vercel, and DiceBear are perfect for scaling your MVP with no upfront cost!
                      </p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap bg-[#1E293B] text-white font-bold px-4 py-2.5 rounded-lg shadow-sm text-xs uppercase tracking-wider border border-slate-700">
                    Est. Dev Cost: $0.00
                  </div>
                </div>

                {/* Main Recommended Stack Matrix Styled as Clean Panel */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#2563EB]" />
                    Service Integration Matrix
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse" id="stack-directory-table">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Feature</th>
                          <th className="py-3 px-4">Free Service/API</th>
                          <th className="py-3 px-4">Core Purpose</th>
                          <th className="py-3 px-4 text-right">Interactive Code</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {STACK_FEATURES.map((feat) => {
                          const isSelected = selectedFeature.feature === feat.feature;
                          return (
                            <tr 
                              key={feat.feature}
                              className={`group cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                                isSelected ? "bg-[#EFF6FF]" : ""
                              }`}
                              onClick={() => setSelectedFeature(feat)}
                            >
                              <td className="py-3 px-4 font-bold text-[#1E293B] flex items-center gap-2.5">
                                <span className={`p-1.5 rounded-lg transition-colors ${
                                  isSelected ? "bg-[#DBEAFE] text-[#1E40AF]" : "bg-[#F1F5F9] text-[#475569] group-hover:bg-[#E2E8F0]"
                                }`}>
                                  {feat.icon === "Lock" && <Lock className="w-3.5 h-3.5" />}
                                  {feat.icon === "Database" && <Database className="w-3.5 h-3.5" />}
                                  {feat.icon === "MessageSquare" && <MessageSquare className="w-3.5 h-3.5" />}
                                  {feat.icon === "Server" && <Server className="w-3.5 h-3.5" />}
                                  {feat.icon === "Globe" && <Globe className="w-3.5 h-3.5" />}
                                  {feat.icon === "Image" && <Image className="w-3.5 h-3.5" />}
                                  {feat.icon === "PhoneCall" && <PhoneCall className="w-3.5 h-3.5" />}
                                  {feat.icon === "Map" && <Map className="w-3.5 h-3.5" />}
                                  {feat.icon === "Compass" && <Compass className="w-3.5 h-3.5" />}
                                  {feat.icon === "Bell" && <Bell className="w-3.5 h-3.5" />}
                                  {feat.icon === "User" && <User className="w-3.5 h-3.5" />}
                                  {feat.icon === "Cpu" && <Cpu className="w-3.5 h-3.5" />}
                                </span>
                                {feat.feature}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-md bg-[#F1F5F9] text-[#1E40AF] font-mono text-[10px] border border-[#E2E8F0] font-semibold">
                                  {feat.freeService}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[#64748B] max-w-xs truncate font-medium">{feat.purpose}</td>
                              <td className="py-3 px-4 text-right">
                                <button className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all ${
                                  isSelected 
                                    ? "bg-[#1E293B] text-white" 
                                    : "bg-[#F1F5F9] text-[#475569] group-hover:bg-[#E2E8F0]"
                                }`}>
                                  View Setup
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Developer Implementation Checklist styled as Panel */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    Interactive Roadmap & Milestones
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-[#64748B] mb-4 font-medium">Complete the development milestones below to track your self-hosted chat applet progress.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(checklist).map(([key, checked]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setChecklist(prev => ({ ...prev, [key]: !checked }));
                            triggerAlert(`Milestone checklist updated: ${key}`, "success");
                          }}
                          className={`flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                            checked 
                              ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]" 
                              : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <span className="text-xs font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          {checked ? (
                            <Check className="w-4 h-4 text-[#10B981]" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-300 bg-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Code Boilerplate Right Column */}
              <div className="flex flex-col gap-6">
                
                {/* Boilerplate Code Block wrapped in Panel styling */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-[#2563EB]" />
                      <span>Setup Blueprint</span>
                    </div>
                    <span className="text-[10px] bg-[#DBEAFE] text-[#1E40AF] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {selectedFeature.category}
                    </span>
                  </div>
                  <div className="bg-[#0F172A] text-slate-100 p-5 flex flex-col h-full relative overflow-hidden">
                    {/* Glowing background accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 z-10">
                      <div>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{selectedFeature.freeService} Library</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">{selectedFeature.feature} Blueprint</h4>
                      </div>
                      
                      <button
                        id="btn-copy-code"
                        onClick={() => handleCopyCode(selectedFeature.implementationGuide)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border border-slate-700"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedCode ? "Copied" : "Copy"}
                      </button>
                    </div>

                    <div className="overflow-auto max-h-[360px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                      <pre className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-lg border border-slate-800/40 select-all overflow-x-auto">
                        <code>{selectedFeature.implementationGuide}</code>
                      </pre>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
                      <Info className="w-4 h-4 text-[#3B82F6] shrink-0" />
                      <span>Standard zero-cost developmental implementation blueprint.</span>
                    </div>
                  </div>
                </div>

                {/* App Showcase Preview Card (Styled as Promo Box) */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-between">
                  {/* Wave decor */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_left,var(--color-indigo-400)_0%,transparent_60%)]"></div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#1E40AF]">Featured Spotlight</span>
                    </div>
                    <h4 className="text-base font-extrabold text-[#0F172A] mb-2">Social "People Around Me" Radar</h4>
                    <p className="text-xs text-[#1E293B] leading-relaxed mb-5 font-medium">
                      Matches localized users based on selected radiuses and shared interest filters (coding, cricket, photography, etc.) while keeping user privacy safe by showing only approximate distances.
                    </p>
                  </div>

                  <button
                    id="btn-launch-demo"
                    onClick={() => {
                      setActiveTab("app_demo");
                      triggerAlert("Enjoying standout Geochat Link demo. Update your interests profile first!", "success");
                    }}
                    className="w-full bg-[#1E293B] hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    Launch Live Simulation
                    <ChevronRight className="w-4 h-4 text-indigo-400" />
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ======================================================== */}
        {/* TAB 2: GEOCAT LINK - THE STANDOUT SOCIAL RADAR SIMULATOR */}
        {/* ======================================================== */}
        <AnimatePresence mode="wait">
          {activeTab === "app_demo" && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full"
              id="app-demo-workspace"
            >
              
              {/* Left Column: Local Profile Builder & Radar controls (col-span-3) */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* 1. Dynamic User Profile Builder Panel */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#2563EB]" />
                      My Profile Builder
                    </h3>
                    <span className="text-[10px] bg-[#DBEAFE] text-[#1E40AF] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">DiceBear API</span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Avatar generator display */}
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center relative overflow-hidden shrink-0 group">
                        <img 
                          src={avatarUrl} 
                          alt="Your dynamic profile avatar" 
                          className="w-14 h-14 object-contain animate-fade-in"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => {
                            const seeds = ["leo", "sparky", "felix", "scooter", "buster", "shadow", "ginger", "patch"];
                            const randomSeed = seeds[Math.floor(Math.random() * seeds.length)] + Math.floor(Math.random() * 100);
                            setMyProfile(prev => ({ ...prev, avatarSeed: randomSeed }));
                            triggerAlert("DiceBear Profile Avatar updated with random vector seed!", "success");
                          }}
                          title="Generate random profile avatar" 
                          className="absolute inset-0 bg-[#1E293B]/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider transition-opacity duration-250"
                          id="btn-random-avatar"
                        >
                          Roll Seed
                        </button>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Display Handle Name</label>
                        <input 
                          type="text" 
                          id="input-profile-name"
                          value={myProfile.name}
                          onChange={(e) => setMyProfile(prev => ({ ...prev, name: e.target.value || "Anonymous" }))}
                          placeholder="Enter username" 
                          className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#1E293B] focus:outline-none focus:border-[#2563EB] w-full"
                        />
                      </div>
                    </div>

                    {/* Bio Input */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">My Profile Bio</label>
                      <textarea
                        value={myProfile.bio}
                        onChange={(e) => setMyProfile(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Say something cool..."
                        rows={2}
                        className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#2563EB] w-full resize-none"
                      />
                    </div>

                    {/* Profile Interest Tag Toggles */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">My Interests (Tag for matching)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {INTERESTS_LIST.map((tag) => {
                          const isSelected = myProfile.interests.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              id={`tag-toggle-${tag.id}`}
                              onClick={() => handleInterestToggle(tag.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                                isSelected 
                                  ? "bg-[#1E293B] border-[#1E293B] text-white shadow-sm" 
                                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]"
                              }`}
                            >
                              <span className={isSelected ? "text-indigo-400" : "text-[#64748B]"}>
                                {tag.id === "coding" && <Code className="w-3.5 h-3.5" />}
                                {tag.id === "cricket" && <Trophy className="w-3.5 h-3.5" />}
                                {tag.id === "photography" && <Camera className="w-3.5 h-3.5" />}
                                {tag.id === "music" && <Music className="w-3.5 h-3.5" />}
                                {tag.id === "study" && <BookOpen className="w-3.5 h-3.5" />}
                              </span>
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Persist Profile Changes to Cloud Button */}
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Save Profile to Cloud
                    </button>

                    {/* Theme Customization selection */}
                    <div className="border-t border-[#E2E8F0] pt-4 mt-2 flex flex-col gap-3">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        Workspace Theme
                      </label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {PREDEFINED_THEMES.map(t => {
                          const isSelected = customTheme.themeId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                setCustomTheme(prev => ({ ...prev, themeId: t.id, primaryColor: t.primary }));
                                triggerAlert(`Theme switched to ${t.name}!`, "success");
                              }}
                              className={`p-2 rounded-lg border text-left text-[11px] font-bold transition-all flex flex-col gap-1 cursor-pointer ${
                                isSelected 
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-950 shadow-sm" 
                                  : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span>{t.name}</span>
                              <div className="flex gap-1 items-center">
                                <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: t.primary }}></span>
                                <span className="text-[8px] text-[#64748B] font-medium uppercase">{t.id}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom brand color picker and chat wallpaper input */}
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-[#64748B] uppercase">Primary Accent:</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={customTheme.primaryColor}
                              onChange={(e) => setCustomTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                              className="w-5 h-5 rounded cursor-pointer border border-[#E2E8F0] p-0 bg-transparent"
                            />
                            <span className="text-[9px] font-mono text-slate-700 font-bold uppercase">{customTheme.primaryColor}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-[#64748B] uppercase">Custom Chat Wallpaper URL:</span>
                          <input
                            type="text"
                            value={customTheme.chatWallpaper}
                            onChange={(e) => setCustomTheme(prev => ({ ...prev, chatWallpaper: e.target.value }))}
                            placeholder="https://images.unsplash.com/... or blank"
                            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#1E293B] focus:outline-none focus:border-indigo-500 w-full"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. Standout Radar Matcher Controls Panel */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#2563EB]" />
                      Radar Radius Settings
                    </h3>
                    <span className="text-[10px] font-bold text-[#1E40AF] bg-[#DBEAFE] px-2.5 py-0.5 rounded-full uppercase tracking-wider">{searchRadius} km</span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Distance Radius Slider */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-[#64748B] font-bold uppercase tracking-wider">
                        <span>Radius Limit</span>
                        <span className="font-mono text-[#2563EB] font-bold">{searchRadius} km max</span>
                      </div>
                      <input 
                        type="range" 
                        id="range-radius-slider"
                        min="1" 
                        max="10" 
                        value={searchRadius}
                        onChange={(e) => {
                          setSearchRadius(Number(e.target.value));
                          triggerAlert(`Matched users recalculated within ${e.target.value} km radius!`, "info");
                        }}
                        className="w-full accent-[#2563EB] cursor-pointer h-1.5 bg-[#F1F5F9] rounded-lg appearance-none"
                      />
                      <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
                        <span>1 km</span>
                        <span>5 km</span>
                        <span>10 km</span>
                      </div>
                    </div>

                    {/* Info Notice about Privacy with Promo style */}
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 flex gap-2.5 text-xs text-[#1E40AF] leading-relaxed font-medium">
                      <Shield className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold block uppercase tracking-wider text-[#1E40AF] mb-1">Privacy First Protocol</strong>
                        Shows only general distances (e.g., ~1.4 km) instead of specific locations. Your exact location coordinates are kept 100% hidden.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Joined Communities Feed Channels Panel */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center">
                    <span className="font-bold flex items-center gap-1.5">📢 Joined Group Feeds</span>
                  </div>

                  <div className="p-4">
                    {joinedCommunities.length === 0 ? (
                      <div className="text-center py-6 text-[#64748B] text-xs font-medium">
                        Join any community from the radar column to view channels.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {joinedCommunities.map(id => {
                          const comm = communities.find(c => c.id === id);
                          if (!comm) return null;
                          const isActive = activeChatId === comm.id;
                          return (
                            <button
                              key={comm.id}
                              id={`group-feed-${comm.id}`}
                              onClick={() => {
                                setActiveChatId(comm.id);
                                // Seed channel message if empty
                                if (!conversations[comm.id]) {
                                  setConversations(prev => ({
                                    ...prev,
                                    [comm.id]: [
                                      {
                                        id: `msg-welcome-${comm.id}`,
                                        senderId: "system",
                                        senderName: "Community Mod",
                                        senderAvatar: "📢",
                                        text: `Welcome to the ${comm.name} public chatroom! Start conversing with members in this approximate area.`,
                                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                        type: "text"
                                      }
                                    ]
                                  }));
                                }
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                                isActive 
                                  ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]" 
                                  : "bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="p-1.5 rounded bg-[#E2E8F0] text-[#475569] text-xs font-bold">#</span>
                                <div>
                                  <h5 className="text-xs font-bold leading-tight">{comm.name}</h5>
                                  <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">{comm.membersCount} local members</p>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Middle Column: Interactive Locator Radar Map & Matched Connections (col-span-5) */}
              <div className="lg:col-span-5 flex flex-col gap-6" id="radar-column">
                
                {/* Visual locator radar map schematic */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></div>
                      Schematic Social Radar ({filteredPeople.length} Online nearby)
                    </h3>
                    <span className="text-[10px] bg-slate-200 text-[#1E293B] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Approximate Only</span>
                  </div>

                  {/* Real-time GPS & Nominatim Locator Panel */}
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-[#64748B] uppercase block tracking-wider">My Privacy-Safe Area</span>
                        <span className="font-bold text-slate-800 leading-tight block">{userLocatedArea}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleLocateMe}
                      disabled={isLocating}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold tracking-wider hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 disabled:bg-indigo-400 self-start sm:self-auto cursor-pointer text-[10px] uppercase shadow-sm"
                    >
                      {isLocating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Locating...
                        </>
                      ) : (
                        <>
                          <Map className="w-3.5 h-3.5" />
                          Locate Me
                        </>
                      )}
                    </button>
                  </div>

                  {/* Interactive radar SVG Canvas */}
                  <div className="p-4">
                    <div className="w-full bg-[#0F172A] aspect-square rounded-lg relative overflow-hidden flex items-center justify-center border border-slate-800">
                      
                      {/* Radar swept animation scanner */}
                      <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_10%,rgba(99,102,241,0.15)_90%,rgba(99,102,241,0.4)_100%)] rounded-full animate-[spin_6s_linear_infinite] origin-center pointer-events-none"></div>

                      {/* Concentric rings */}
                      <div className="absolute w-[80%] h-[80%] border border-slate-800/80 rounded-full flex items-center justify-center pointer-events-none">
                        <div className="absolute w-[70%] h-[70%] border border-slate-800/60 rounded-full flex items-center justify-center">
                          <div className="absolute w-[45%] h-[45%] border border-slate-800/40 rounded-full flex items-center justify-center">
                            <div className="absolute w-[20%] h-[20%] border border-indigo-500/20 rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      {/* Horizontal & Vertical Crosshairs */}
                      <div className="absolute h-full w-px bg-slate-800/60 pointer-events-none"></div>
                      <div className="absolute w-full h-px bg-slate-800/60 pointer-events-none"></div>

                      {/* Radar Center (You!) */}
                      <div className="absolute z-10 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20 animate-pulse">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                        <span className="absolute -bottom-5 text-[9px] font-bold text-indigo-400 whitespace-nowrap">{myProfile.name} (You)</span>
                      </div>

                      {/* Nearby users mapped onto coordinate spaces based on distance */}
                      {filteredPeople.map((person, idx) => {
                        // Map distances to radii. Since searchRadius changes, distances are scaled to fit visual radius nicely
                        const maxVisualDistance = searchRadius;
                        const relativeDistance = person.distance / maxVisualDistance;
                        const visualPercentage = relativeDistance * 45; // Max 45% radius from center

                        // Give each idx a fixed angle to avoid random movements on state updates
                        const angles = [35, 140, 210, 290, 325];
                        const angle = angles[idx % angles.length] * (Math.PI / 180);
                        
                        const x = Math.cos(angle) * visualPercentage;
                        const y = Math.sin(angle) * visualPercentage;

                        return (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={person.id}
                            id={`radar-node-${person.id}`}
                            onClick={() => {
                              setActiveChatId(person.id);
                              triggerAlert(`Viewing detail card for ${person.name}`, "info");
                            }}
                            style={{
                              left: `calc(50% + ${x}% - 14px)`,
                              top: `calc(50% + ${y}% - 14px)`,
                            }}
                            className={`absolute z-10 p-0.5 rounded-xl border transition-all hover:scale-125 hover:z-20 ${
                              activeChatId === person.id 
                                ? "bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/40" 
                                : "bg-slate-800 border-slate-700 text-slate-300"
                            }`}
                          >
                            <img 
                              src={person.avatar} 
                              alt={person.name} 
                              className="w-6 h-6 rounded-lg bg-slate-900"
                              referrerPolicy="no-referrer"
                            />
                            {/* Floating indicator */}
                            <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] px-1 rounded bg-slate-950/85 text-slate-200 font-mono whitespace-nowrap">
                              ~{person.distance.toFixed(1)}km
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Nearby People list matchcards */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <span>Local Matches Radar</span>
                    <span className="text-[10px] bg-[#EFF6FF] text-[#1E40AF] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Filtered</span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Local matching category filters */}
                    <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 border-b border-[#E2E8F0]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap shrink-0">Interests</span>
                      <div className="flex gap-1.5 overflow-x-auto">
                        <button
                          onClick={() => setActiveInterestFilter("all")}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeInterestFilter === "all" 
                              ? "bg-[#1E293B] text-white" 
                              : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                          }`}
                        >
                          All Matches
                        </button>
                        {INTERESTS_LIST.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setActiveInterestFilter(cat.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                              activeInterestFilter === cat.id 
                                ? "bg-[#2563EB] text-white" 
                                : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Render list of nearby matched connections */}
                    {filteredPeople.length === 0 ? (
                      <div className="text-center py-10 text-[#64748B] text-xs flex flex-col items-center gap-2 font-medium">
                        <AlertCircle className="w-8 h-8 text-[#94A3B8]" />
                        <span>No people found within this radius ({searchRadius} km) with matching filters. Try widening the search radius!</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {filteredPeople.map((person) => (
                          <div 
                            key={person.id}
                            id={`person-card-${person.id}`}
                            className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              activeChatId === person.id 
                                ? "bg-[#EFF6FF] border-[#BFDBFE] shadow-sm" 
                                : "bg-[#F8FAFC] hover:bg-[#F1F5F9] border-[#E2E8F0]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative shrink-0 mt-0.5">
                                <img 
                                  src={person.avatar} 
                                  alt={person.name} 
                                  className="w-11 h-11 rounded-lg bg-white border border-[#E2E8F0] object-contain"
                                  referrerPolicy="no-referrer"
                                />
                                {person.online && (
                                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] rounded-full border-2 border-white"></span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-[#1E293B] truncate">{person.name}</h4>
                                  <span className="text-[10px] text-[#1E40AF] font-bold bg-[#DBEAFE] px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wider">
                                    {person.distance.toFixed(1)} km away
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#475569] line-clamp-2 mt-1 leading-relaxed font-medium">{person.bio}</p>
                                
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {person.interests.map(int => (
                                    <span key={int} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#64748B]">
                                      {int}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-stretch gap-2 shrink-0 justify-end">
                              {person.status === "none" && (
                                <button
                                  id={`btn-invite-${person.id}`}
                                  onClick={() => handleSendRequest(person.id)}
                                  className="bg-[#1E293B] hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                >
                                  Send Request
                                </button>
                              )}
                              {person.status === "sent" && (
                                <span className="text-center text-[9px] font-bold text-[#D97706] bg-[#FEF3C7] border border-[#FCD34D] py-1.5 px-3 rounded uppercase tracking-wider">
                                  Pending Accept
                                </span>
                              )}
                              {person.status === "received" && (
                                <button
                                  id={`btn-accept-${person.id}`}
                                  onClick={() => handleAcceptRequest(person.id)}
                                  className="bg-[#10B981] hover:bg-emerald-600 text-white font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all"
                                >
                                  Accept Request
                                </button>
                              )}
                              {person.status === "accepted" && (
                                <button
                                  id={`btn-chat-with-${person.id}`}
                                  onClick={() => {
                                    setActiveChatId(person.id);
                                    triggerAlert(`Opened chat with ${person.name}`, "success");
                                  }}
                                  className={`font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all ${
                                    activeChatId === person.id 
                                      ? "bg-[#1E293B] text-white" 
                                      : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                                  }`}
                                >
                                  Chat Open
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Local interest-based communities listed */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">🗺️ Local Communities ({filteredCommunities.length})</span>
                    <button
                      id="btn-create-community"
                      onClick={() => setShowCreateCommunity(true)}
                      className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-indigo-600/10"
                    >
                      <Plus className="w-3 h-3" /> Create
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {filteredCommunities.map((comm) => {
                        const joined = joinedCommunities.includes(comm.id);
                        return (
                          <div 
                            key={comm.id}
                            className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between gap-3 hover:border-indigo-200 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#1E40AF]">
                                  {comm.icon === "Code" && <Code className="w-3.5 h-3.5" />}
                                  {comm.icon === "Trophy" && <Trophy className="w-3.5 h-3.5" />}
                                  {comm.icon === "Camera" && <Camera className="w-3.5 h-3.5" />}
                                  {comm.icon === "BookOpen" && <BookOpen className="w-3.5 h-3.5" />}
                                  {comm.icon === "Music" && <Music className="w-3.5 h-3.5" />}
                                </span>
                                <h5 className="text-xs font-bold text-[#1E293B]">{comm.name}</h5>
                              </div>
                              <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed font-medium">{comm.description}</p>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5">
                              <span className="text-[10px] font-bold text-[#475569] font-mono">{comm.distance} km away</span>
                              <button
                                id={`btn-join-${comm.id}`}
                                onClick={() => handleJoinCommunity(comm.id)}
                                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded transition-all ${
                                  joined 
                                    ? "bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]" 
                                    : "bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#475569]"
                                }`}
                              >
                                {joined ? "Joined" : "Join"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>


              {/* Right Column: Premium Interactive Messaging Window (col-span-4) */}
              <div className="lg:col-span-4 flex flex-col h-[760px] max-h-screen bg-white rounded-xl border border-[#E2E8F0] shadow-sm relative overflow-hidden" id="chat-window">
                
                {/* 1. Header of conversation (contact info + calls + actions) */}
                <div className="bg-[#F1F5F9] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    {/* Dynamic Avatar or custom icons */}
                    {activeChatId === "ai-assistant" ? (
                      <div className="w-10 h-10 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-lg shadow-sm font-bold border border-blue-400/20">
                        🤖
                      </div>
                    ) : (
                      (() => {
                        const person = nearbyPeople.find(p => p.id === activeChatId);
                        const community = communities.find(c => c.id === activeChatId);
                        
                        return (
                          <div className="relative flex items-center justify-center">
                            {person ? (
                              <img 
                                src={person.avatar} 
                                alt={person.name} 
                                className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : community ? (
                              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-[#1E40AF] flex items-center justify-center text-lg font-bold border border-indigo-200">
                                {community.icon === "Code" && <Code className="w-5 h-5" />}
                                {community.icon === "Trophy" && <Trophy className="w-5 h-5" />}
                                {community.icon === "Camera" && <Camera className="w-5 h-5" />}
                                {community.icon === "BookOpen" && <BookOpen className="w-5 h-5" />}
                                {community.icon === "Music" && <Music className="w-5 h-5" />}
                                {!["Code", "Trophy", "Camera", "BookOpen", "Music"].includes(community.icon || "") && "📢"}
                              </div>
                            ) : (
                              <img 
                                src="https://api.dicebear.com/7.x/identicon/svg?seed=comm" 
                                alt="Community" 
                                className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {person && person.online && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] rounded-full border-2 border-white"></span>
                            )}
                          </div>
                        );
                      })()
                    )}
 
                     <div>
                      <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider leading-tight flex items-center gap-1.5">
                        {activeChatId === "ai-assistant" ? "Linky AI Assistant" : (nearbyPeople.find(p => p.id === activeChatId)?.name || communities.find(c => c.id === activeChatId)?.name || "Chat Room")}
                        {activeChatId === "ai-assistant" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1E40AF] font-bold font-mono tracking-wide">Real-time Gemini</span>}
                      </h3>
                      <p className="text-[10px] text-[#64748B] mt-0.5 flex items-center gap-1 font-bold">
                        {activeChatId === "ai-assistant" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                            Online (Always ready)
                          </>
                        ) : (
                          nearbyPeople.find(p => p.id === activeChatId)?.online ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                              Active now
                            </>
                          ) : (
                            "Offline channel"
                          )
                        )}
                        {nearbyPeople.find(p => p.id === activeChatId)?.typing && " | Typing..."}
                      </p>
                    </div>
                  </div>
 
                   {/* WebRTC Video & Voice Call initiation & Gemini Summarize buttons */}
                   <div className="flex items-center gap-1.5">
                     {/* AI Summarizer Button */}
                     <button 
                       id="btn-summarize-chat"
                       onClick={handleSummarizeConversation}
                       disabled={isSummarizing}
                       className="p-2 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                       title="Summarize conversation with Gemini AI"
                     >
                       {isSummarizing ? (
                         <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                       ) : (
                         <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                       )}
                       <span className="text-[9px] font-extrabold uppercase tracking-wider hidden sm:inline">AI Summary</span>
                     </button>

                     {!communities.some(c => c.id === activeChatId) && (
                       <>
                         <button 
                           id="btn-voice-call"
                           onClick={() => startCall("voice")}
                           className="p-2.5 rounded-lg bg-white hover:bg-slate-100 border border-[#E2E8F0] text-slate-600 transition-colors cursor-pointer"
                           title="Start voice call (WebRTC)"
                         >
                           <Volume2 className="w-4 h-4 text-[#475569]" />
                         </button>
                         <button 
                           id="btn-video-call"
                           onClick={() => startCall("video")}
                           className="p-2.5 rounded-lg bg-white hover:bg-slate-100 border border-[#E2E8F0] text-slate-600 transition-colors cursor-pointer"
                           title="Start video call (WebRTC)"
                         >
                           <Video className="w-4 h-4 text-[#475569]" />
                         </button>
                       </>
                     )}
                   </div>
                 </div>
 
                 {/* 2. Messages conversation viewport scroll pane */}
                 <div className="flex-1 p-4 overflow-y-auto bg-[#F8FAFC] flex flex-col gap-3.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent relative" style={customTheme.chatWallpaper ? { backgroundImage: `url(${customTheme.chatWallpaper})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                                       {/* Conversation Summary Overlay Modal */}
                    <AnimatePresence>
                      {activeSummary && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 15 }}
                          className="p-4 bg-white/95 backdrop-blur-md rounded-xl border border-indigo-100 shadow-xl flex flex-col gap-3 mb-4 shrink-0 relative z-30"
                        >
                          <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">AI Conversation Summary</h4>
                            </div>
                            <button
                              onClick={() => setActiveSummary(null)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-[#475569] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-700 leading-relaxed font-medium">
                            {activeSummary}
                          </div>
                          <button
                            onClick={() => setActiveSummary(null)}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider self-end shadow cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* GIPHY & Tenor Search Sheet Trigger Overlay */}
                    <AnimatePresence>
                      {gifSearchOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: "100%" }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: "100%" }}
                          className="absolute inset-x-0 bottom-0 h-[340px] bg-white border-t border-[#E2E8F0] z-25 flex flex-col shadow-2xl rounded-t-2xl"
                        >
                          <div className="bg-[#F1F5F9] px-4 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4 text-indigo-600 animate-pulse" />
                              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">GIFs & Stickers Library</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setGifSearchType(prev => prev === "gifs" ? "stickers" : "gifs")}
                                className="text-[9px] font-extrabold px-2.5 py-1 rounded bg-white border border-[#E2E8F0] hover:bg-slate-100 uppercase tracking-wider cursor-pointer"
                              >
                                Show {gifSearchType === "gifs" ? "Stickers" : "GIFs"}
                              </button>
                              <button
                                onClick={() => setGifSearchOpen(false)}
                                className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="p-2.5 border-b border-[#E2E8F0] bg-slate-50 flex gap-2">
                            <input
                              type="text"
                              value={gifSearchQuery}
                              onChange={(e) => setGifSearchQuery(e.target.value)}
                              placeholder={`Type to search GIPHY & Tenor ${gifSearchType}...`}
                              className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-bold"
                            />
                          </div>

                          <div className="flex-1 p-2.5 overflow-y-auto bg-slate-100">
                            {gifLoading ? (
                              <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2 font-bold">
                                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Fetching animations...
                              </div>
                            ) : gifResults.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-bold">
                                No GIPHY/Tenor results.
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {gifResults.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      handleSendMessage(item.url, "image");
                                      setGifSearchOpen(false);
                                      triggerAlert("Shared animation successfully!", "success");
                                    }}
                                    className="relative aspect-video rounded bg-slate-200 border border-slate-300 overflow-hidden hover:scale-105 transition-all cursor-pointer shadow-sm"
                                  >
                                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Chat invitation gating checks */}
                    {(() => {
                      const activePeer = nearbyPeople.find(p => p.id === activeChatId);
                      if (activePeer && activePeer.status !== "accepted") {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white/95 backdrop-blur-sm rounded-xl border border-[#E2E8F0] my-auto gap-4 shadow-sm max-w-[340px] mx-auto z-10">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center relative shadow-sm">
                              <img src={activePeer.avatar} alt={activePeer.name} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                              {activePeer.online && (
                                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
                              )}
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">Connect with {activePeer.name}</h4>
                              <p className="text-[11px] text-[#64748B] font-medium leading-relaxed">
                                Exact locations are kept safe. A chat invitation must be sent and accepted before direct messaging can begin.
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-1 justify-center max-w-[280px]">
                              {activePeer.interests.map(tag => (
                                <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div className="w-full border-t border-slate-100 pt-3.5 flex justify-center">
                              {activePeer.status === "none" && (
                                <button
                                  onClick={() => handleSendRequest(activePeer.id)}
                                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider shadow hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Send Chat Invitation
                                </button>
                              )}

                              {activePeer.status === "sent" && (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                                    Invitation Pending
                                  </span>
                                  <span className="text-[10px] text-amber-600 italic">They usually accept in 4-5 seconds!</span>
                                </div>
                              )}

                              {activePeer.status === "received" && (
                                <div className="flex gap-2.5 w-full">
                                  <button
                                    onClick={() => handleAcceptRequest(activePeer.id)}
                                    className="flex-1 py-2.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeclineRequest(activePeer.id);
                                    }}
                                    className="flex-1 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Render messages log
                      return ((conversations[activeChatId] || []).length === 0) ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-[#64748B] text-xs p-6 gap-2">
                          <MessageCircle className="w-10 h-10 text-[#94A3B8] animate-bounce" />
                          <p className="font-medium max-w-[200px] leading-relaxed">No messages here yet. Say hi to start the conversation!</p>
                        </div>
                      ) : (
                      (conversations[activeChatId] || []).map((msg) => {
                       const isMe = msg.senderId === "me";
                       const isSystem = msg.senderId === "system";
                       
                       return (
                         <div 
                           key={msg.id}
                           className={`flex flex-col max-w-[85%] ${isMe ? "self-end items-end" : "self-start items-start"} ${isSystem ? "max-w-full self-center" : ""}`}
                         >
                           {/* Sender name label */}
                           {!isMe && !isSystem && (
                             <span className="text-[10px] font-bold text-[#64748B] mb-0.5 ml-1">{msg.senderName}</span>
                           )}
 
                           {isSystem ? (
                             <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-2.5 text-xs text-[#1E40AF] text-center font-bold my-2 shadow-sm leading-relaxed max-w-[90%]">
                               {msg.text}
                             </div>
                           ) : (
                             <div 
                               className={`p-3 rounded-xl shadow-sm text-xs leading-relaxed relative group transition-all ${
                                 isMe 
                                   ? "bg-[#1E293B] text-white rounded-tr-none" 
                                   : "bg-white text-[#1E293B] border border-[#E2E8F0] rounded-tl-none"
                               }`}
                             >
                               {/* Original / Main Text */}
                               <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
 
                               {/* Translated Display Layer */}
                               {msg.translation && (
                                 <div className={`mt-2.5 pt-2.5 border-t text-[11px] flex flex-col gap-1.5 ${
                                   isMe ? "border-slate-700 text-slate-200" : "border-slate-100 text-[#475569]"
                                 }`}>
                                   <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                                     <Languages className="w-3.5 h-3.5 shrink-0 text-[#2563EB]" />
                                     Translated ({selectedTranslationLang.toUpperCase()}):
                                   </span>
                                   <p className="italic font-medium">{msg.translation}</p>
                                   <button 
                                     onClick={() => handleHideTranslation(msg.id)}
                                     className="text-[9px] font-bold uppercase tracking-wider underline hover:opacity-80 self-start"
                                   >
                                     Hide Translation
                                   </button>
                                 </div>
                               )}
 
                               {/* Media / Image Attachments */}
                               {msg.type === "image" && msg.mediaUrl && (
                                 <div className="mt-2.5 rounded-lg overflow-hidden border border-[#E2E8F0] max-w-[200px]">
                                   <img src={msg.mediaUrl} alt="Shared preview" className="w-full h-auto object-cover" />
                                 </div>
                               )}
 
                               {/* File download attachment mock */}
                               {msg.type === "file" && (
                                 <div className="mt-2.5 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#1E293B] flex items-center gap-2">
                                   <Paperclip className="w-4 h-4 text-[#64748B] shrink-0" />
                                   <div className="truncate">
                                     <p className="font-bold truncate">{msg.fileName}</p>
                                     <p className="text-[9px] text-[#64748B] font-medium">{msg.fileSize}</p>
                                   </div>
                                 </div>
                               )}
 
                               {/* Simulated Audio Voice Player */}
                               {msg.type === "audio" && (
                                 <div className="mt-2.5 p-2.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] flex items-center gap-2 max-w-[240px]">
                                   <button className="w-7 h-7 rounded-full bg-[#1E40AF] flex items-center justify-center text-white shrink-0 hover:bg-blue-800">
                                     <Play className="w-3.5 h-3.5 ml-0.5 fill-current text-white" />
                                   </button>
                                   <div className="flex-1 flex flex-col gap-1">
                                     <div className="h-4 flex items-center gap-0.5">
                                       <div className="w-1 h-2 bg-[#2563EB] rounded-full animate-pulse"></div>
                                       <div className="w-1 h-4 bg-[#2563EB] rounded-full animate-pulse"></div>
                                       <div className="w-1 h-3 bg-[#2563EB] rounded-full animate-pulse"></div>
                                       <div className="w-1 h-1 bg-[#2563EB] rounded-full"></div>
                                       <div className="w-1 h-3 bg-[#2563EB] rounded-full animate-pulse"></div>
                                       <div className="w-1 h-4 bg-[#2563EB] rounded-full animate-pulse"></div>
                                       <div className="w-1 h-2 bg-[#2563EB] rounded-full animate-pulse"></div>
                                     </div>
                                     <span className="text-[9px] text-[#2563EB] font-mono font-bold">0:12 s • Recorded</span>
                                   </div>
                                 </div>
                               )}
 
                               {/* Quick Hover Reactions Bar & Actions */}
                               <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-xl shadow-md z-10 ${
                                 isMe ? "right-full mr-2" : "left-full ml-2"
                               }`}>
                                 <button 
                                   onClick={() => handleReaction(msg.id, "👍")}
                                   className="hover:scale-125 transition-transform"
                                   title="Like"
                                 >
                                   👍
                                 </button>
                                 <button 
                                   onClick={() => handleReaction(msg.id, "❤️")}
                                   className="hover:scale-125 transition-transform"
                                   title="Love"
                                 >
                                   ❤️
                                 </button>
                                 <button 
                                   onClick={() => handleReaction(msg.id, "🔥")}
                                   className="hover:scale-125 transition-transform"
                                   title="Fire"
                                 >
                                   🔥
                                 </button>
                                 
                                 <div className="w-px h-3 bg-slate-200 mx-1"></div>
 
                                 {/* Instant Translate Button */}
                                 {msg.type === "text" && !msg.translation && (
                                   <button
                                     id={`btn-translate-msg-${msg.id}`}
                                     onClick={() => handleTranslateMessage(msg.id, msg.text)}
                                     className="p-1 text-slate-500 hover:text-[#2563EB]"
                                     title="Translate via Gemini AI"
                                   >
                                     <Languages className="w-3.5 h-3.5" />
                                   </button>
                                 )}
 
                                 <button
                                   onClick={() => handleDeleteMessage(msg.id)}
                                   className="p-1 text-slate-400 hover:text-rose-600"
                                   title="Delete message"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>
 
                               {/* Rendered Reactions */}
                               {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                 <div className="flex gap-1 mt-1.5 flex-wrap">
                                   {Object.entries(msg.reactions).map(([emoji, count]) => (
                                     <span key={emoji} className="text-[10px] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full border border-[#E2E8F0] text-[#1E293B] font-bold font-mono">
                                       {emoji} {count}
                                     </span>
                                   ))}
                                 </div>
                               )}
 
                             </div>
                           )}
 
                           {/* Timestamp info line */}
                           {!isSystem && (
                             <span className="text-[9px] text-[#64748B] mt-1 font-mono font-bold">{msg.timestamp}</span>
                           )}
                         </div>
                       );
                     })
                    );
                  })()}
 
                   {/* Gemini AI processing spinner indicator */}
                   {aiIsResponding && (
                     <div className="self-start flex flex-col items-start max-w-[85%]">
                       <span className="text-[10px] font-bold text-[#64748B] mb-0.5 ml-1">Linky AI Assistant</span>
                       <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg rounded-tl-none text-xs flex items-center gap-2 text-[#1E40AF]">
                         <RefreshCw className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
                         <span className="font-bold">Linky is thinking via Gemini API...</span>
                       </div>
                     </div>
                   )}
                 </div>
 
                 {/* 3. Input Controls Bar (emojis, upload, message textbox, send, translate configuration) */}
                 <div className={`${(nearbyPeople.find(p => p.id === activeChatId)?.status || "accepted") !== "accepted" ? "hidden" : "flex"} bg-[#F1F5F9] border-t border-[#E2E8F0] p-3 flex-col gap-2 relative z-10`} id="chat-controls">
                    {/* Suggested Smart Replies quick chips */}
                    {(loadingSmartReplies || (suggestedReplies[activeChatId] || []).length > 0) && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none" id="smart-replies-container">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                          <Sparkles className="w-3 h-3 text-indigo-600 animate-pulse" /> Suggestions:
                        </span>
                        {loadingSmartReplies ? (
                          <span className="text-[10px] text-slate-400 font-bold animate-pulse">Analyzing context...</span>
                        ) : (
                          (suggestedReplies[activeChatId] || []).map((reply, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                handleSendMessage(reply);
                                setSuggestedReplies(prev => ({ ...prev, [activeChatId]: [] })); // Clear after sending
                              }}
                              className="text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 text-[#1E293B] hover:text-indigo-700 transition-all cursor-pointer whitespace-nowrap shadow-sm hover:shadow active:scale-95 shrink-0"
                            >
                              {reply}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                   
                   {/* Translate target language quick bar */}
                   <div className="flex items-center justify-between text-[11px] text-[#64748B] border-b border-[#E2E8F0] pb-2 font-bold">
                     <span className="flex items-center gap-1">
                       <Languages className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                       Configure Translate Output target:
                     </span>
                     <select
                       id="select-target-lang"
                       value={selectedTranslationLang}
                       onChange={(e) => setSelectedTranslationLang(e.target.value)}
                       className="bg-white border border-[#E2E8F0] px-2 py-0.5 rounded font-extrabold text-xs text-[#1E293B] cursor-pointer focus:outline-none focus:border-[#2563EB]"
                     >
                       {translationLanguages.map(lang => (
                         <option key={lang.code} value={lang.code}>{lang.name}</option>
                       ))}
                     </select>
                   </div>
 
                   <div className="flex items-center gap-2">
                     
                     {/* Media Attach buttons */}
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       onChange={handleFileChange} 
                       className="hidden" 
                       accept="image/*,.pdf,.doc,.docx"
                     />
                     <button
                       onClick={() => fileInputRef.current?.click()}
                       className="p-2.5 bg-white hover:bg-slate-100 border border-[#E2E8F0] rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                       title="Share images/documents (Cloudinary)"
                     >
                       <Paperclip className="w-4 h-4 text-[#475569]" />
                     </button>
 
                     {/* Voice Note Recording Simulator button */}
                     <button
                       onClick={toggleRecording}
                       className={`p-2.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                         isRecording 
                           ? "bg-rose-600 border-rose-600 text-white animate-pulse font-bold" 
                           : "bg-white hover:bg-slate-100 border-[#E2E8F0] text-slate-500 hover:text-slate-800"
                       }`}
                       title="Record and translate a Voice message"
                     >
                       {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#475569]" />}
                       {isRecording && <span className="text-[10px] font-mono">{recordingSeconds}s</span>}
                     </button>
 
                     {/* Chat Text Input Box */}
                     <input 
                       type="text" 
                       id="input-chat-message"
                       value={messageInput}
                       onChange={(e) => setMessageInput(e.target.value)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') handleSendMessage();
                       }}
                       placeholder={isRecording ? "Microphone recording active..." : `Chat here... Try saying: Hi AI!`}
                       disabled={isRecording}
                       className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] disabled:opacity-50 font-bold text-[#1E293B]"
                     />
 
                     {/* Send Button */}
                     <button
                       id="btn-send-message"
                       onClick={() => handleSendMessage()}
                       disabled={isRecording || (!messageInput.trim())}
                       className="p-2.5 rounded-lg bg-[#1E293B] text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-[#1E293B] transition-colors shadow-sm"
                     >
                       <Send className="w-4 h-4" />
                     </button>
                   </div>
                 </div>


                {/* CALL SCREEN OVERLAY VIEWPORT (Triggers on active call status) */}
                <AnimatePresence>
                  {callState.status !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6"
                      id="webrtc-call-overlay"
                    >
                      {/* Video Camera feeds grid */}
                      <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 relative">
                        {callState.type === "video" ? (
                          <div className="w-full h-full max-h-[360px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden relative flex items-center justify-center">
                            
                            {/* Live client camera stream element */}
                            {localStream ? (
                              <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Video className="w-12 h-12 text-slate-600 animate-pulse" />
                                <span className="text-xs">Connecting Camera Stream...</span>
                              </div>
                            )}

                            {/* PIP box (partner avatar view overlay) */}
                            <div className="absolute top-4 right-4 w-24 h-28 rounded-xl bg-slate-950/80 border border-slate-700 flex flex-col items-center justify-center p-2 shadow-lg">
                              <img 
                                src={callState.partnerAvatar} 
                                alt={callState.partnerName} 
                                className="w-10 h-10 rounded-full bg-slate-900" 
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-[10px] font-bold mt-1 text-slate-300 truncate w-full text-center">{callState.partnerName}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-24 h-24 rounded-full bg-indigo-500/10 border-2 border-indigo-400/40 flex items-center justify-center relative animate-pulse">
                              <img 
                                src={callState.partnerAvatar} 
                                alt={callState.partnerName} 
                                className="w-20 h-20 rounded-full bg-slate-900" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="text-center">
                              <h4 className="text-base font-bold">{callState.partnerName}</h4>
                              <p className="text-xs text-indigo-400 font-mono mt-1 uppercase tracking-wider">
                                {callState.status === "ringing" ? "Ringing via WebRTC..." : "Voice Connected"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Call duration counter */}
                      {callState.status === "connected" && (
                        <div className="mb-4 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full font-mono text-xs text-slate-300 tracking-wider">
                          Duration: {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                        </div>
                      )}

                      {/* Controls (Mute, Camera toggle, Hang up) */}
                      <div className="flex items-center gap-6">
                        <button className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                          <MicOff className="w-5 h-5" />
                        </button>
                        
                        {/* Red Hang up button */}
                        <button 
                          id="btn-hangup"
                          onClick={endCall}
                          className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-lg shadow-rose-600/30 transform hover:scale-110"
                        >
                          <PhoneOff className="w-6 h-6" />
                        </button>

                        <button className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Create Community Modal */}
                <AnimatePresence>
                  {showCreateCommunity && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                      >
                        <div className="bg-[#F1F5F9] px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            🗺️ Create Local Community
                          </h3>
                          <button
                            onClick={() => setShowCreateCommunity(false)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <form onSubmit={handleCreateCommunity} className="p-5 flex flex-col gap-4">
                          <div className="text-[11px] text-slate-500 leading-relaxed bg-blue-50 text-blue-700 border border-blue-100 rounded-lg p-3">
                            📍 <strong>Geotagging Active:</strong> Your community will be created at your current coordinates (<strong>{myProfile.latitude?.toFixed(4)}, {myProfile.longitude?.toFixed(4)}</strong>), allowing nearby users to discover it.
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                              Community Name
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={40}
                              placeholder="e.g. Downtown Coffee & Code"
                              value={newCommName}
                              onChange={(e) => setNewCommName(e.target.value)}
                              className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                              Primary Interest Category
                            </label>
                            <select
                              value={newCommCategory}
                              onChange={(e) => setNewCommCategory(e.target.value)}
                              className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700"
                            >
                              {INTERESTS_LIST.map((int) => (
                                <option key={int.id} value={int.id}>
                                  {int.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                              Description (Max 140 chars)
                            </label>
                            <textarea
                              maxLength={140}
                              placeholder="What is this community about? Weekly meetups? Discussions?"
                              value={newCommDescription}
                              onChange={(e) => setNewCommDescription(e.target.value)}
                              className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white min-h-[80px] resize-none font-medium"
                            />
                          </div>

                          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 mt-2">
                            <button
                              type="button"
                              onClick={() => setShowCreateCommunity(false)}
                              className="text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Create & Join
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer Info credit lines */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          <span>Integrated with <strong>Google GenAI 3.5 Flash Model</strong>. Powered by server-side APIs.</span>
        </div>
        <div className="flex gap-4">
          <a href="#" onClick={() => setActiveTab("developer")} className="hover:text-indigo-600 transition-colors">API Stack Table</a>
          <span className="text-slate-300">|</span>
          <a href="#" onClick={() => setActiveTab("app_demo")} className="hover:text-indigo-600 transition-colors">Live Geochat Simulation</a>
        </div>
      </footer>

    </div>
  );
}
