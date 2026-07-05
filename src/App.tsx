import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Lock, Database, MessageSquare, Server, Globe, Image, PhoneCall, Phone,
  Map, Compass, Bell, User, Cpu, Code, Trophy, Camera, Music, BookOpen, 
  Send, Shield, CheckCircle, Copy, Check, Users, MessageCircle, AlertCircle, 
  Volume2, Video, PhoneOff, MicOff, Mic, Smile, Paperclip, Trash2, Languages,
  ChevronRight, Sparkles, Play, Square, Info, RefreshCw, X, Palette, Clock, Film, Plus,
  Star, ChevronLeft, Pause, LogOut, Heart, Flag, Search, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StackFeature, ChatMessage, NearbyUser, CallState, Story, Post } from "./types";
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
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { AuthScreen } from "./components/AuthScreen";
import { LocalCommunity } from "./types";

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = (import.meta as any).env.VITE_FIREBASE_DATABASE_ID 
  ? getFirestore(firebaseApp, (import.meta as any).env.VITE_FIREBASE_DATABASE_ID)
  : getFirestore(firebaseApp);
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

const STORY_PRESET_MEDIA = [
  { name: "None", url: "", type: undefined },
  { name: "Sunset Beach", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80", type: "image" },
  { name: "Cyberpunk City", url: "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&w=500&q=80", type: "image" },
  { name: "Coffee Vibing", url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=500&q=80", type: "image" },
  { name: "Neon Forest", url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80", type: "image" },
  { name: "Sunset Sea Video", url: "https://assets.mixkit.co/videos/preview/mixkit-sunset-over-the-sea-12711-large.mp4", type: "video" },
  { name: "Cozy Rainfall Video", url: "https://assets.mixkit.co/videos/preview/mixkit-raindrops-on-a-window-at-night-42171-large.mp4", type: "video" }
];

export default function App() {
  // Scroll collapse states
  const [isScrolled, setIsScrolled] = useState(false);
  const [isForceExpanded, setIsForceExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Navigation
  const [activeTab, setActiveTab] = useState<"developer" | "app_demo">("app_demo");
  const [mobileDemoTab, setMobileDemoTab] = useState<"radar" | "friends" | "share" | "chat" | "profile">("radar");

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
    visibility: "public" | "private";
  }>(() => {
    const saved = localStorage.getItem("geochat_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) {
          return {
            ...parsed,
            visibility: parsed.visibility || "public"
          };
        }
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
      visibility: "public" as const
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
  const [publicPostsScope, setPublicPostsScope] = useState<"global" | "nearby">("nearby");
  const [selectedRadarTarget, setSelectedRadarTarget] = useState<any | null>(null);
  
  // Dynamic User database (synchronized from Firestore in real-time)
  const [nearbyPeople, setNearbyPeople] = useState<NearbyUser[]>([]);
  const [connectionsData, setConnectionsData] = useState<{ [userId: string]: { status: string; senderId: string; receiverId: string; connectionId: string } }>({});
  
  // Instagram-like Stories state with local fallback & media uploads
  const [stories, setStories] = useState<Story[]>([]);
  const [localStories, setLocalStories] = useState<Story[]>(() => {
    try {
      const saved = localStorage.getItem("geochat_local_stories");
      if (saved) {
        const parsed = JSON.parse(saved);
        const now = new Date().getTime();
        // Keep only stories from the last 24 hours
        return parsed.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp)
        })).filter((s: Story) => (now - s.timestamp.getTime()) / (1000 * 60 * 60) < 24);
      }
    } catch (e) {}
    return [];
  });

  // Scrollable persistent Posts state with local fallback
  const [posts, setPosts] = useState<Post[]>([]);
  const [localPosts, setLocalPosts] = useState<Post[]>(() => {
    try {
      const saved = localStorage.getItem("geochat_local_posts");
      if (saved) {
        const parsed = JSON.parse(saved);
        const now = new Date().getTime();
        return parsed.map((p: any) => ({
          ...p,
          timestamp: new Date(p.timestamp)
        })).filter((p: Post) => {
          if (p.expirationHours && p.expirationHours > 0) {
            const hrsDiff = (now - p.timestamp.getTime()) / (1000 * 60 * 60);
            return hrsDiff < p.expirationHours;
          }
          return true;
        });
      }
    } catch (e) {}
    return [];
  });

  const [shareTabMode, setShareTabMode] = useState<"post" | "story">("post");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState<"public" | "nearby_public">("nearby_public");
  const [newPostExpiration, setNewPostExpiration] = useState<number>(0); // 0 = never
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaUrl, setPostMediaUrl] = useState<string>("");
  const [postMediaType, setPostMediaType] = useState<"image" | "video" | undefined>(undefined);
  const [postMediaPreview, setPostMediaPreview] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("geochat_local_posts", JSON.stringify(localPosts));
  }, [localPosts]);

  useEffect(() => {
    localStorage.setItem("geochat_local_stories", JSON.stringify(localStories));
  }, [localStories]);

  // Close Friends system state
  const [closeFriendIds, setCloseFriendIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("geochat_close_friend_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleCloseFriend = (userId: string) => {
    setCloseFriendIds((prev) => {
      let updated;
      if (prev.includes(userId)) {
        updated = prev.filter(id => id !== userId);
        triggerAlert("Removed from Close Friends list", "info");
      } else {
        updated = [...prev, userId];
        triggerAlert("Added to Close Friends list", "success");
      }
      localStorage.setItem("geochat_close_friend_ids", JSON.stringify(updated));
      return updated;
    });
  };

  const mergedStories = useMemo(() => {
    const all = [...stories, ...localStories];
    
    const uniq: Story[] = [];
    all.forEach(s => {
      // Check if this story is a duplicate of one already in uniq
      const isDuplicate = uniq.some(existing => 
        existing.id === s.id || 
        (existing.userId === s.userId && 
         existing.content === s.content && 
         Math.abs(new Date(existing.timestamp).getTime() - new Date(s.timestamp).getTime()) < 300000)
      );
      if (!isDuplicate) {
        uniq.push(s);
      }
    });
    return uniq.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [stories, localStories]);

  const mergedPosts = useMemo(() => {
    const all = [...posts, ...localPosts];
    const uniq: Post[] = [];
    all.forEach(p => {
      const isDuplicate = uniq.some(existing => 
        existing.id === p.id || 
        (existing.userId === p.userId && 
         existing.content === p.content && 
         Math.abs(new Date(existing.timestamp).getTime() - new Date(p.timestamp).getTime()) < 300000)
      );
      if (!isDuplicate) {
        uniq.push(p);
      }
    });
    return uniq.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [posts, localPosts]);

  const [newStoryContent, setNewStoryContent] = useState("");
  const [newStoryType, setNewStoryType] = useState<"public" | "friends" | "close_friends">("public");
  const [isSubmittingStory, setIsSubmittingStory] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<{ userName: string; avatar: string; stories: Story[] } | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);

  // Auto-advance timer for Instagram-style story viewer
  useEffect(() => {
    if (!activeStoryGroup || isStoryPaused) return;
    const total = activeStoryGroup.stories.length;
    if (total <= 0) return;

    const interval = setInterval(() => {
      setCurrentStoryIndex((prev) => {
        if (prev + 1 < total) {
          return prev + 1;
        } else {
          setActiveStoryGroup(null);
          return 0;
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [activeStoryGroup, isStoryPaused]);

  // Story media file upload & preset states
  const [storyMediaFile, setStoryMediaFile] = useState<File | null>(null);
  const [storyMediaUrl, setStoryMediaUrl] = useState<string>("");
  const [storyMediaType, setStoryMediaType] = useState<"image" | "video" | undefined>(undefined);
  const [storyMediaPreview, setStoryMediaPreview] = useState<string>("");
  
  // Active Chat and Conversations
  const [activeChatId, setActiveChatId] = useState<string>("ai-assistant");
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const [mobileShowInbox, setMobileShowInbox] = useState<boolean>(true);
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
  const [activeMessageToolbarId, setActiveMessageToolbarId] = useState<string | null>(null);
  const [showLangMenuMsgId, setShowLangMenuMsgId] = useState<string | null>(null);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const postsEndRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazily loading older posts
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry && firstEntry.isIntersecting) {
        setVisiblePostsCount(prev => prev + 5);
      }
    }, {
      root: null,
      rootMargin: "100px",
      threshold: 0.1
    });

    const target = postsEndRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, []);

  // Live Radar sweeping & subtle coordinates drift state
  const [radarTime, setRadarTime] = useState(0);
  
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

  // Custom states added for user request
  const [customInterestInput, setCustomInterestInput] = useState("");
  const [searchFriendsQuery, setSearchFriendsQuery] = useState("");
  const [postsSearchQuery, setPostsSearchQuery] = useState("");
  const [postsCategoryFilter, setPostsCategoryFilter] = useState("all");
  const [visiblePostsCount, setVisiblePostsCount] = useState(5);
  const [showStickersAndGifs, setShowStickersAndGifs] = useState(false);
  const [stickersAndGifsTab, setStickersAndGifsTab] = useState<"stickers" | "gifs">("stickers");

  const STICKERS_LIST = [
    { id: "s1", name: "Cool Cat", url: "https://media.giphy.com/media/C9x8gX02SnMIoAclby/giphy.gif" },
    { id: "s2", name: "Happy Shiba", url: "https://media.giphy.com/media/L3305Li1RCoFa3bkuO/giphy.gif" },
    { id: "s3", name: "Cute Panda", url: "https://media.giphy.com/media/13CoXDiaCcC9R6/giphy.gif" },
    { id: "s4", name: "Thumbs Up", url: "https://media.giphy.com/media/Lp71UIp7G19OBG8UP4/giphy.gif" },
    { id: "s5", name: "Love Heart", url: "https://media.giphy.com/media/l0HrO2O3P1334U4q4/giphy.gif" },
    { id: "s6", name: "Fire", url: "https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif" },
    { id: "s7", name: "Clap Hands", url: "https://media.giphy.com/media/3o7qDQ4kcSD1PLM3BK/giphy.gif" },
    { id: "s8", name: "Party", url: "https://media.giphy.com/media/l0IybQ6l8UBvXncly/giphy.gif" }
  ];

  const GIFS_LIST = [
    { id: "g1", name: "Excited", url: "https://media.giphy.com/media/12u37L9UPUX9Ek/giphy.gif" },
    { id: "g2", name: "Mind Blown", url: "https://media.giphy.com/media/26ufdipOdAL5WArf6/giphy.gif" },
    { id: "g3", name: "Cat Typing", url: "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif" },
    { id: "g4", name: "Laughing", url: "https://media.giphy.com/media/10YqgGno9beCBy/giphy.gif" },
    { id: "g5", name: "Thumbs Up", url: "https://media.giphy.com/media/3o7abKhOpu0NXS3HBC/giphy.gif" },
    { id: "g6", name: "Shocked", url: "https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif" },
    { id: "g7", name: "Happy Tears", url: "https://media.giphy.com/media/2WxWfocaVudCOEP4bC/giphy.gif" },
    { id: "g8", name: "Party Time", url: "https://media.giphy.com/media/l2JhIerYVf8b6E2l2/giphy.gif" }
  ];

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
          longitude: data.longitude || -122.4194,
          visibility: data.visibility || "public"
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
          longitude: -122.4194,
          visibility: "public" as const
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

  // Real-time Call Signaling listener
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;

    // 1. Listen to calls where I am the receiver (incoming calls)
    const receiverRef = doc(db, "calls", myProfile.id);
    const unsubReceiver = onSnapshot(receiverRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "ringing") {
          setCallState({
            type: data.type,
            status: "incoming",
            partnerId: data.callerId,
            partnerName: data.callerName,
            partnerAvatar: data.callerAvatar
          });
        } else if (data.status === "connected" && callState.status === "ringing") {
          // Caller side: Receiver answered
          setCallState(prev => ({ ...prev, status: "connected" }));
        } else if (data.status === "ended") {
          // Terminated
          setCallState({ type: "none", status: "idle" });
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
          }
        }
      }
    }, (err) => {
      console.error("Receiver call snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, `calls/${myProfile.id}`);
    });

    // 2. If I am the caller, I also want to listen to B's document to see if they accepted or ended the call
    let unsubCaller: (() => void) | null = null;
    if (callState.partnerId && callState.partnerId !== "ai-assistant") {
      const partnerRef = doc(db, "calls", callState.partnerId);
      unsubCaller = onSnapshot(partnerRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === "connected") {
            setCallState(prev => ({ ...prev, status: "connected" }));
          } else if (data.status === "ended") {
            setCallState({ type: "none", status: "idle" });
            if (localStream) {
              localStream.getTracks().forEach(track => track.stop());
              setLocalStream(null);
            }
          }
        }
      }, (err) => {
        console.error("Caller call snapshot error:", err);
        handleFirestoreError(err, OperationType.GET, `calls/${callState.partnerId}`);
      });
    }

    return () => {
      unsubReceiver();
      if (unsubCaller) unsubCaller();
    };
  }, [db, myProfile.id, callState.status, callState.partnerId, localStream]);

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

  // Live Radar sweeping & subtle coordinates drift simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setRadarTime(prev => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Smoothly auto-scroll chat messages container to bottom on messages / chat state update
  useEffect(() => {
    const scrollContainer = chatMessagesContainerRef.current;
    if (scrollContainer) {
      const scrollDown = () => {
        // Direct assignment ensures instant jump to prevent any layout offset issues
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth"
        });
      };
      scrollDown();
      // Execute again slightly later to capture images or smart replies rendering
      const t = setTimeout(scrollDown, 120);
      return () => clearTimeout(t);
    }
  }, [conversations, activeChatId, aiIsResponding, isTyping]);

  // 3. Real-time Listener for ALL Users in Firestore
  useEffect(() => {
    if (!db || !authUser || !myProfile.id || myProfile.id !== authUser.uid) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: NearbyUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id !== myProfile.id && !data.id.startsWith("user-")) {
          let status: "none" | "sent" | "received" | "accepted" = "none";
          const conn = connectionsData[data.id];
          if (conn) {
            if (conn.status === "accepted") {
              status = "accepted";
            } else if (conn.status === "pending") {
              status = conn.senderId === myProfile.id ? "sent" : "received";
            }
          }

          // Privacy Check: if user's profile is PRIVATE and we are not accepted friends, hide them from radar discovery!
          if (data.visibility === "private" && status !== "accepted") {
            return;
          }

          const dist = calculateDistance(
            myProfile.latitude || 37.7749,
            myProfile.longitude || -122.4194,
            data.latitude || 37.7749,
            data.longitude || -122.4194
          );

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

  // Real-time Listener for ALL Stories in Firestore (filtered for 24 hours, desc order)
  useEffect(() => {
    if (!db || !authUser || !myProfile.id) return;
    const q = query(collection(db, "stories"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Story[] = [];
      const now = new Date().getTime();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const storyTime = data.timestamp?.toDate() || new Date();
        const hrsDiff = (now - storyTime.getTime()) / (1000 * 60 * 60);
        
        // Keep stories shared in the last 24 hours
        if (hrsDiff < 24) {
          list.push({
            id: doc.id,
            userId: data.userId,
            userName: data.userName,
            avatar: data.avatar,
            content: data.content,
            type: data.type || "public",
            timestamp: storyTime,
            latitude: data.latitude || 37.7749,
            longitude: data.longitude || -122.4194,
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined
          });
        }
      });
      // Sort descending (latest first)
      list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setStories(list);
    }, (err) => {
      console.error("Stories snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, "stories");
    });
    return () => unsubscribe();
  }, [db, authUser, myProfile.id]);

  // Real-time Listener for ALL Posts in Firestore
  useEffect(() => {
    if (!db || !authUser || !myProfile.id) return;
    const q = query(collection(db, "posts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Post[] = [];
      const now = new Date().getTime();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const postTime = data.timestamp?.toDate() || new Date();
        
        let expired = false;
        if (data.expirationHours && data.expirationHours > 0) {
          const hrsDiff = (now - postTime.getTime()) / (1000 * 60 * 60);
          if (hrsDiff >= data.expirationHours) {
            expired = true;
          }
        }
        
        if (!expired) {
          list.push({
            id: doc.id,
            userId: data.userId || "",
            userName: data.userName || "",
            avatar: data.avatar || "",
            content: data.content || "",
            type: data.type || "public",
            timestamp: postTime,
            latitude: data.latitude || 37.7749,
            longitude: data.longitude || -122.4194,
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined,
            expirationHours: data.expirationHours || 0,
            likes: data.likes || []
          });
        }
      });
      list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setPosts(list);
    }, (err) => {
      console.error("Posts snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, "posts");
    });
    return () => unsubscribe();
  }, [db, authUser, myProfile.id]);

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
        bio: myProfile.bio || "",
        visibility: myProfile.visibility || "public"
      }, { merge: true });
      triggerAlert("Profile successfully synchronized to Cloud Firestore!", "success");
    } catch (err) {
      console.error("Save profile failed:", err);
      triggerAlert("Failed to save profile details to Cloud Firestore.", "error");
    }
  };

  // Delete a story shared by the current user
  const handleDeleteStory = async (storyId: string) => {
    if (!storyId) return;

    // 1. Remove from localStories state
    setLocalStories(prev => prev.filter(s => s.id !== storyId));
    // 2. Remove from stories state (if populated from Firestore)
    setStories(prev => prev.filter(s => s.id !== storyId));

    try {
      if (db) {
        // Try deleting by document ID directly (id is doc.id)
        await deleteDoc(doc(db, "stories", storyId));
        
        // Also query to make sure if it was saved with a custom id field
        const q = query(collection(db, "stories"), where("id", "==", storyId));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "stories", docSnap.id)));
        await Promise.all(deletePromises);
      }
      triggerAlert("Story deleted successfully!", "success");
    } catch (err) {
      console.error("Failed to delete story from Firestore:", err);
      triggerAlert("Removed story from local view!", "info");
    }

    // Adjust activeStoryGroup or close it if no stories remain
    if (activeStoryGroup) {
      const updatedStories = activeStoryGroup.stories.filter(s => s.id !== storyId);
      if (updatedStories.length > 0) {
        // Adjust current active story index
        const nextIndex = Math.min(currentStoryIndex, updatedStories.length - 1);
        setCurrentStoryIndex(nextIndex);
        setActiveStoryGroup({
          ...activeStoryGroup,
          stories: updatedStories
        });
      } else {
        setActiveStoryGroup(null);
      }
    }
  };

  // Post dynamic story/status to Firestore (with local fallback & media)
  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryContent.trim() || !myProfile.id) return;
    setIsSubmittingStory(true);
    
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${myProfile.avatarSeed}`;
    const initialStoryId = `story_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const userId = myProfile.id;
    const userName = myProfile.name;
    const avatar = avatarUrl;
    const latitude = myProfile.latitude || 37.7749;
    const longitude = myProfile.longitude || -122.4194;
    
    const storyPayload: Story = {
      id: initialStoryId,
      userId: userId,
      userName: userName,
      avatar: avatar,
      content: newStoryContent.trim(),
      type: newStoryType,
      timestamp: now,
      latitude: latitude,
      longitude: longitude,
      mediaUrl: storyMediaUrl || undefined,
      mediaType: storyMediaType || undefined,
      closeFriendIds: newStoryType === "close_friends" ? closeFriendIds : undefined
    };

    // Try to sync to Firestore, otherwise save locally
    try {
      if (db) {
        const storiesRef = collection(db, "stories");
        const newDocRef = doc(storiesRef);
        const firestoreId = newDocRef.id;
        
        // Update story ID with Firestore doc ID to prevent duplicates!
        storyPayload.id = firestoreId;
        setLocalStories(prev => [storyPayload, ...prev]);

        await setDoc(newDocRef, {
          id: firestoreId,
          userId: storyPayload.userId,
          userName: storyPayload.userName,
          avatar: storyPayload.avatar,
          content: storyPayload.content,
          type: storyPayload.type,
          timestamp: serverTimestamp(),
          latitude: storyPayload.latitude,
          longitude: storyPayload.longitude,
          mediaUrl: storyPayload.mediaUrl || null,
          mediaType: storyPayload.mediaType || null,
          closeFriendIds: storyPayload.closeFriendIds || null
        });
        triggerAlert("Story was shared successfully!", "success");
      } else {
        setLocalStories(prev => [storyPayload, ...prev]);
        triggerAlert("Firestore not connected. Story saved in your local session!", "info");
      }
    } catch (err) {
      console.error("Failed to share story to Cloud Firestore:", err);
      setLocalStories(prev => [storyPayload, ...prev]);
      triggerAlert("Cloud database offline. Saved in local session!", "info");
    } finally {
      // Clear inputs
      setNewStoryContent("");
      setStoryMediaFile(null);
      setStoryMediaUrl("");
      setStoryMediaType(undefined);
      setStoryMediaPreview("");
      setIsSubmittingStory(false);
    }
  };

  // Create public/nearby Post and sync to Firestore
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !myProfile.id) return;
    setIsSubmittingPost(true);
    
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${myProfile.avatarSeed}`;
    const initialPostId = `post_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const postPayload: Post = {
      id: initialPostId,
      userId: myProfile.id,
      userName: myProfile.name,
      avatar: avatarUrl,
      content: newPostContent.trim(),
      type: newPostType,
      timestamp: now,
      latitude: myProfile.latitude || 37.7749,
      longitude: myProfile.longitude || -122.4194,
      mediaUrl: postMediaUrl || undefined,
      mediaType: postMediaType || undefined,
      expirationHours: newPostExpiration,
      likes: []
    };

    try {
      if (db) {
        const postsRef = collection(db, "posts");
        const newDocRef = doc(postsRef);
        const firestoreId = newDocRef.id;

        postPayload.id = firestoreId;
        setLocalPosts(prev => [postPayload, ...prev]);

        await setDoc(newDocRef, {
          id: firestoreId,
          userId: postPayload.userId,
          userName: postPayload.userName,
          avatar: postPayload.avatar,
          content: postPayload.content,
          type: postPayload.type,
          timestamp: serverTimestamp(),
          latitude: postPayload.latitude,
          longitude: postPayload.longitude,
          mediaUrl: postPayload.mediaUrl || null,
          mediaType: postPayload.mediaType || null,
          expirationHours: postPayload.expirationHours,
          likes: []
        });
        triggerAlert("Post was published successfully!", "success");
      } else {
        setLocalPosts(prev => [postPayload, ...prev]);
        triggerAlert("Firestore not connected. Post saved in your local session!", "info");
      }
    } catch (err) {
      console.error("Failed to share post to Cloud Firestore:", err);
      setLocalPosts(prev => [postPayload, ...prev]);
      triggerAlert("Cloud database offline. Saved in local session!", "info");
    } finally {
      // Clear inputs
      setNewPostContent("");
      setPostMediaFile(null);
      setPostMediaUrl("");
      setPostMediaType(undefined);
      setPostMediaPreview("");
      setIsSubmittingPost(false);
      setMobileDemoTab("radar"); // Switch back to posts tab
    }
  };

  // Delete a post
  const handleDeletePost = async (postId: string) => {
    if (!postId) return;
    
    setLocalPosts(prev => prev.filter(p => p.id !== postId));
    setPosts(prev => prev.filter(p => p.id !== postId));

    try {
      if (db) {
        // Try deleting by document ID directly (if id is doc.id)
        await deleteDoc(doc(db, "posts", postId));
        
        // Also query to make sure if it was saved with a custom id field
        const q = query(collection(db, "posts"), where("id", "==", postId));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "posts", docSnap.id)));
        await Promise.all(deletePromises);
      }
      triggerAlert("Post deleted successfully!", "success");
    } catch (err) {
      console.error("Failed to delete post from Firestore:", err);
      triggerAlert("Removed post from local view!", "info");
    }
  };

  // Report/flag a post
  const handleReportPost = async (postId: string) => {
    if (!postId || !myProfile.id) return;
    
    // First, flag locally so user immediately sees response
    triggerAlert("Post has been flagged and reported. Our safety team will review it.", "success");

    try {
      if (db) {
        // Try direct doc update
        const postRef = doc(db, "posts", postId);
        await updateDoc(postRef, {
          reports: arrayUnion(myProfile.id)
        });
      }
    } catch (err) {
      console.error("Failed to flag post in Firestore:", err);
      // Fallback: search for custom doc match if needed
      try {
        if (db) {
          const q = query(collection(db, "posts"), where("id", "==", postId));
          const querySnapshot = await getDocs(q);
          const updatePromises = querySnapshot.docs.map(docSnap => 
            updateDoc(doc(db, "posts", docSnap.id), {
              reports: arrayUnion(myProfile.id)
            })
          );
          await Promise.all(updatePromises);
        }
      } catch (innerErr) {
        console.error("Deep report fallback also failed:", innerErr);
      }
    }
  };

  // Toggle like
  const handleToggleLike = async (postId: string) => {
    if (!postId || !myProfile.id) return;

    // Toggle locally first
    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const likes = p.likes || [];
        const updatedLikes = likes.includes(myProfile.id)
          ? likes.filter(id => id !== myProfile.id)
          : [...likes, myProfile.id];
        return { ...p, likes: updatedLikes };
      }
      return p;
    }));

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const likes = p.likes || [];
        const updatedLikes = likes.includes(myProfile.id)
          ? likes.filter(id => id !== myProfile.id)
          : [...likes, myProfile.id];
        return { ...p, likes: updatedLikes };
      }
      return p;
    }));

    try {
      if (db) {
        const q = query(collection(db, "posts"));
        const snapshot = await getDocs(q);
        let docId = null;
        let currentLikes: string[] = [];
        snapshot.forEach((doc) => {
          if (doc.id === postId || doc.data().id === postId) {
            docId = doc.id;
            currentLikes = doc.data().likes || [];
          }
        });

        if (docId) {
          const updatedLikes = currentLikes.includes(myProfile.id)
            ? currentLikes.filter(id => id !== myProfile.id)
            : [...currentLikes, myProfile.id];
          await updateDoc(doc(db, "posts", docId), { likes: updatedLikes });
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  // Filter visible stories based on location, privacy, and active view context
  const radarStories = useMemo(() => {
    return mergedStories.filter(story => {
      // Only show public stories/posts in Radar Stories Feed
      if (story.type !== "public" && story.type !== "nearby_public") return false;

      // Show own public stories always
      if (story.userId === myProfile.id) return true;

      const dist = calculateDistance(
        myProfile.latitude || 37.7749,
        myProfile.longitude || -122.4194,
        story.latitude || 37.7749,
        story.longitude || -122.4194
      );

      if (publicPostsScope === "nearby") {
        // Both "public" and "nearby_public" are only visible if nearby
        return dist <= searchRadius;
      } else {
        // publicPostsScope === "global":
        // "public" (Global Public) can be seen by anyone.
        // "nearby_public" (Nearby Public) can ONLY be seen by nearby users.
        if (story.type === "nearby_public") {
          return dist <= searchRadius;
        }
        return true; // Global public is seen by anyone
      }
    });
  }, [mergedStories, publicPostsScope, myProfile.latitude, myProfile.longitude, searchRadius, myProfile.id]);

  const shareStories = useMemo(() => {
    return mergedStories.filter(story => {
      // ONLY private or friends only stories, no public posts of any kind
      if (story.type === "public" || story.type === "nearby_public") return false;

      // Show own stories always
      if (story.userId === myProfile.id) return true;

      // Check friendship status
      const conn = connectionsData[story.userId];
      const isFriend = conn && conn.status === "accepted";

      // 1. Close Friends Stories
      if (story.type === "close_friends") {
        if (story.closeFriendIds && Array.isArray(story.closeFriendIds)) {
          return story.closeFriendIds.includes(myProfile.id);
        }
        return isFriend && closeFriendIds.includes(story.userId);
      }

      // 2. Friends Stories (including private)
      return isFriend;
    });
  }, [mergedStories, connectionsData, closeFriendIds, myProfile.id]);

  const visibleStories = useMemo(() => {
    if (mobileDemoTab === "share") {
      return shareStories;
    } else {
      // Show BOTH public stories AND private/friends stories that the user has access to!
      // This ensures private stories are visible in the main stories tray on laptop/mobile.
      const combined = [...radarStories];
      shareStories.forEach(s => {
        if (!combined.some(c => c.id === s.id)) {
          combined.push(s);
        }
      });
      return combined;
    }
  }, [mobileDemoTab, shareStories, radarStories]);

  const radarPosts = useMemo(() => {
    return mergedPosts.filter(post => {
      if (post.type !== "public" && post.type !== "nearby_public") return false;

      // 1. Keyword search (by content or username)
      if (postsSearchQuery.trim()) {
        const queryStr = postsSearchQuery.toLowerCase().trim();
        const matchesContent = post.content?.toLowerCase().includes(queryStr);
        const matchesUser = post.userName?.toLowerCase().includes(queryStr);
        const matchesCategory = post.category?.toLowerCase().includes(queryStr);
        if (!matchesContent && !matchesUser && !matchesCategory) return false;
      }

      // 2. Category / Content type filter
      if (postsCategoryFilter !== "all") {
        if (postsCategoryFilter === "text") {
          if (post.mediaUrl) return false;
        } else if (postsCategoryFilter === "image") {
          if (!post.mediaUrl || post.mediaType === "video") return false;
        } else if (postsCategoryFilter === "video") {
          if (post.mediaType !== "video") return false;
        }
      }

      if (post.userId === myProfile.id) return true;

      const dist = calculateDistance(
        myProfile.latitude || 37.7749,
        myProfile.longitude || -122.4194,
        post.latitude || 37.7749,
        post.longitude || -122.4194
      );

      if (publicPostsScope === "nearby") {
        return dist <= searchRadius;
      } else {
        if (post.type === "nearby_public") {
          return dist <= searchRadius;
        }
        return true;
      }
    });
  }, [mergedPosts, publicPostsScope, myProfile.latitude, myProfile.longitude, searchRadius, myProfile.id, postsSearchQuery, postsCategoryFilter]);

  // Radians to match people dynamically
  const filteredPeople = nearbyPeople.filter(person => {
    // Except friends who are in my friends list (accepted status)
    if (person.status === "accepted") return false;

    // Search field: searching user ID or Name should appear
    if (searchFriendsQuery.trim()) {
      const query = searchFriendsQuery.toLowerCase().trim();
      const matchesId = person.id.toLowerCase().includes(query);
      const matchesName = person.name.toLowerCase().includes(query);
      return matchesId || matchesName;
    }

    // Distance check
    if (person.distance > searchRadius) return false;

    return true;
  });

  const filteredCommunities = communities.filter(comm => {
    if (comm.distance > searchRadius) return false;
    return true;
  });

  // Helper to compute deterministic coordinates on circular radar plane based on ID and distance with real-time drift
  const getCoordinates = (id: string, distance: number) => {
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
      sum += id.charCodeAt(i);
    }
    
    // Create a gentle real-time drifting/oscillating motion for each node
    const idSeed = sum % 100;
    const timeFactor = (radarTime * (0.01 + (idSeed * 0.002)));
    const angleOffset = Math.sin(timeFactor) * 0.15; // smooth angle offset
    const radiusOffset = Math.cos(timeFactor * 1.5) * 2; // smooth radial offset
    
    // Deterministic spread to prevent overlapping of items with similar or 0 distance
    // We use idSeed with golden angle (137.5 degrees) for optimal distribution
    const baseAngle = (idSeed * 137.5) * (Math.PI / 180);
    const angle = baseAngle + angleOffset;
    
    const maxRange = Math.max(searchRadius, 1);
    
    // If distance is 0.0 (uninitialized or overlapping), assign a visual pseudo-distance so dots don't pile up
    const visualDistance = distance === 0 ? (0.2 + (idSeed % 5) * 0.15) : distance;
    
    // Limit radius between 18% (to clear central 10x10 avatar) and 42% from center
    const radius = 18 + Math.min((visualDistance / maxRange) * 24, 24) + radiusOffset; 
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { x, y };
  };

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
  const handleReaction = async (messageId: string, emoji: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    let updatedReactions: { [key: string]: number } = {};
    const updated = chatMsgs.map(m => {
      if (m.id === messageId) {
        const r = { ...(m.reactions || {}) };
        r[emoji] = (r[emoji] || 0) + 1;
        updatedReactions = r;
        return { ...m, reactions: r };
      }
      return m;
    });
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));

    // Sync to Firestore in real-time
    if (db && activeChatId !== "ai-assistant") {
      try {
        const isCommunity = activeChatId.startsWith("comm-");
        let docRef;
        if (isCommunity) {
          docRef = doc(db, "communities", activeChatId, "messages", messageId);
        } else {
          const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
          docRef = doc(db, "connections", connectionId, "messages", messageId);
        }
        await updateDoc(docRef, { reactions: updatedReactions });
      } catch (err) {
        console.error("Failed to save reaction in Firestore:", err);
      }
    }
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

  const handleSendStickerOrGif = (url: string, type: "sticker" | "gif") => {
    handleSendMessage(type === "sticker" ? "[Sticker]" : "[GIF]", "image", {
      name: `${type}.gif`,
      size: "100KB",
      url: url
    });
    setShowStickersAndGifs(false);
  };

  // Instant Translate using server-side Gemini endpoint
  const handleTranslateMessage = async (msgId: string, text: string, targetLangCode: string, targetLangName: string) => {
    setTranslatingMsgId(msgId);
    try {
      const response = await fetch("/api/gemini/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          targetLanguage: targetLangName
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Update message with translation
      const chatMsgs = conversations[activeChatId] || [];
      const updated = chatMsgs.map(m => {
        if (m.id === msgId) {
          return { ...m, translation: data.translation, originalText: text, targetLangName };
        }
        return m;
      });

      setConversations(prev => ({ ...prev, [activeChatId]: updated }));

      // Sync translation to Firestore
      if (db && activeChatId !== "ai-assistant") {
        try {
          const isCommunity = activeChatId.startsWith("comm-");
          let docRef;
          if (isCommunity) {
            docRef = doc(db, "communities", activeChatId, "messages", msgId);
          } else {
            const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
            docRef = doc(db, "connections", connectionId, "messages", msgId);
          }
          await updateDoc(docRef, { 
            translation: data.translation, 
            originalText: text,
            targetLangName: targetLangName
          });
        } catch (err) {
          console.error("Failed to save translation in Firestore:", err);
        }
      }

      triggerAlert(`Translated into ${targetLangName}!`, "success");
    } catch (err: any) {
      console.error("Translation Error:", err);
      triggerAlert(`Could not translate: ${err.message}`, "error");
    } finally {
      setTranslatingMsgId(null);
    }
  };

  // Revert/hide translation
  const handleHideTranslation = async (msgId: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    const updated = chatMsgs.map(m => {
      if (m.id === msgId) {
        const copy = { ...m };
        delete copy.translation;
        delete copy.originalText;
        delete copy.targetLangName;
        return copy;
      }
      return m;
    });
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));

    // Sync removal to Firestore
    if (db && activeChatId !== "ai-assistant") {
      try {
        const isCommunity = activeChatId.startsWith("comm-");
        let docRef;
        if (isCommunity) {
          docRef = doc(db, "communities", activeChatId, "messages", msgId);
        } else {
          const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
          docRef = doc(db, "connections", connectionId, "messages", msgId);
        }
        await updateDoc(docRef, {
          translation: null,
          originalText: null,
          targetLangName: null
        });
      } catch (err) {
        console.error("Failed to remove translation in Firestore:", err);
      }
    }
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
  const startCall = async (type: "voice" | "video") => {
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

    if (activeChatId === "ai-assistant") {
      // Connect Linky AI after 2.5 seconds
      setTimeout(() => {
        setCallState(prev => ({ ...prev, status: "connected" }));
        triggerAlert(`WebRTC peer-to-peer connection established with Linky AI!`, "success");
      }, 2500);
      return;
    }

    if (!db) return;
    try {
      await setDoc(doc(db, "calls", activeChatId), {
        callerId: myProfile.id,
        callerName: myProfile.name,
        callerAvatar: avatarUrl,
        receiverId: activeChatId,
        type: type,
        status: "ringing",
        createdAt: serverTimestamp()
      });

      if (type === "video") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
        } catch (e) {
          console.error("Camera access failed", e);
        }
      }
    } catch (err) {
      console.error("Failed to write call session:", err);
    }
  };

  const acceptCall = async () => {
    if (!db) return;
    try {
      const callRef = doc(db, "calls", myProfile.id);
      await updateDoc(callRef, {
        status: "connected"
      });

      if (callState.type === "video") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
        } catch (e) {
          console.error("Camera access failed", e);
        }
      }

      setCallState(prev => ({ ...prev, status: "connected" }));
      triggerAlert("Call connected successfully!", "success");
    } catch (err) {
      console.error("Failed to accept call:", err);
    }
  };

  const declineCall = async () => {
    if (!db) return;
    try {
      const callRef = doc(db, "calls", myProfile.id);
      await updateDoc(callRef, {
        status: "ended"
      });
      setCallState({ type: "none", status: "idle" });
      triggerAlert("Call declined.", "info");
    } catch (err) {
      console.error("Failed to decline call:", err);
    }
  };

  const endCall = async () => {
    const partnerId = callState.partnerId;
    setCallState({ type: "none", status: "idle" });
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    triggerAlert("Call hung up.", "info");

    if (!db || !partnerId) return;
    try {
      await setDoc(doc(db, "calls", partnerId), { status: "ended" }, { merge: true });
      await setDoc(doc(db, "calls", myProfile.id), { status: "ended" }, { merge: true });
    } catch (err) {
      console.error("Failed to end call session in Firestore:", err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    const chatMsgs = conversations[activeChatId] || [];
    const updated = chatMsgs.filter(m => m.id !== msgId);
    setConversations(prev => ({ ...prev, [activeChatId]: updated }));
    triggerAlert("Message deleted.", "info");

    // Sync to Firestore in real-time
    if (db && activeChatId !== "ai-assistant") {
      try {
        const isCommunity = activeChatId.startsWith("comm-");
        let docRef;
        if (isCommunity) {
          docRef = doc(db, "communities", activeChatId, "messages", msgId);
        } else {
          const connectionId = myProfile.id < activeChatId ? `${myProfile.id}_${activeChatId}` : `${activeChatId}_${myProfile.id}`;
          docRef = doc(db, "connections", connectionId, "messages", msgId);
        }
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Failed to delete message in Firestore:", err);
      }
    }
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
        
        <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex flex-row items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm border border-slate-700">
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 select-none">
                Geochat Link
              </h1>
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
      <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-4 md:px-6 py-2.5 shadow-md shadow-slate-950/25">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-1.5 sm:gap-2">
          <div 
            className="flex items-center gap-2 select-none"
          >
            <div className="rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm border border-slate-700 w-8 h-8 shrink-0">
              <Compass className="text-emerald-400 w-4 h-4" />
            </div>
            <div>
              <h1 className="font-black tracking-tight text-white flex items-center gap-1 text-sm sm:text-base">
                Geochat Link
              </h1>
            </div>
          </div>

          {authUser && (
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 relative shrink-0">
              {/* Bell Icon & Notification Dropdown */}
              <div className="relative">
                <button
                  id="btn-bell-notifications"
                  onClick={() => setShowRequestsDropdown(prev => !prev)}
                  className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all relative cursor-pointer flex items-center justify-center shadow-sm p-2 shrink-0"
                >
                  <Bell className="w-3.5 h-3.5" />
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
                      className="absolute right-0 mt-2.5 w-72 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-slate-800 origin-top-right -right-12 sm:right-0"
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

              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-2 py-1 transition-all shrink-0">
                <img 
                  src={avatarUrl} 
                  alt="My Profile avatar" 
                  className="rounded bg-slate-950 object-contain w-6 h-6 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden sm:block">
                  <span className="font-black text-slate-100 block leading-none text-xs truncate max-w-[80px]">
                    {myProfile.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    signOut(auth).then(() => {
                      triggerAlert("Signed out successfully from Geochat workspace.", "info");
                    });
                  }}
                  className="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all font-bold text-[9px] uppercase tracking-wider rounded cursor-pointer px-2 py-1 flex items-center gap-1 shrink-0"
                  title="Log Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
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
              className="flex-1 p-4 lg:p-6 pb-24 max-w-2xl mx-auto w-full flex flex-col gap-6"
              id="app-demo-workspace"
            >
              
              {/* Profile, Story, Post and Chat feeds directly aligned in responsive grids */}
                
                {/* 1. Dynamic User Profile Builder Panel */}
                <div className={`col-span-12 max-w-2xl mx-auto w-full bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "profile" ? "flex" : "hidden"}`}>
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
                    <div className="flex flex-col gap-3 mb-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Preset Interests (Toggle to select)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {INTERESTS_LIST.map((tag) => {
                            const isSelected = myProfile.interests.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                id={`tag-toggle-${tag.id}`}
                                onClick={() => handleInterestToggle(tag.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
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

                      {/* Add Custom Interest input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Add Custom Interest</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type an interest (e.g. cooking, football)..."
                            value={customInterestInput}
                            onChange={(e) => setCustomInterestInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = customInterestInput.trim().toLowerCase();
                                if (trimmed && !myProfile.interests.includes(trimmed)) {
                                  setMyProfile(prev => ({ ...prev, interests: [...prev.interests, trimmed] }));
                                  setCustomInterestInput("");
                                  triggerAlert(`Added custom interest: "${trimmed}"`, "success");
                                }
                              }
                            }}
                            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#2563EB] flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = customInterestInput.trim().toLowerCase();
                              if (trimmed && !myProfile.interests.includes(trimmed)) {
                                setMyProfile(prev => ({ ...prev, interests: [...prev.interests, trimmed] }));
                                setCustomInterestInput("");
                                triggerAlert(`Added custom interest: "${trimmed}"`, "success");
                              }
                            }}
                            className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* All active interests display */}
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">My Active Interests ({myProfile.interests.length})</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg min-h-[44px]">
                          {myProfile.interests.length === 0 ? (
                            <span className="text-xs text-slate-400 font-bold self-center">No active interests yet. Choose presets or add custom interests.</span>
                          ) : (
                            myProfile.interests.map((int) => {
                              const preset = INTERESTS_LIST.find(p => p.id === int);
                              return (
                                <span
                                  key={int}
                                  className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1"
                                >
                                  {preset ? preset.name : int}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMyProfile(prev => ({ ...prev, interests: prev.interests.filter(i => i !== int) }));
                                      triggerAlert(`Removed interest "${int}"`, "info");
                                    }}
                                    className="hover:bg-slate-200 rounded-full p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })
                          )}
                        </div>
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

                    {/* PROFILE VISIBILITY */}
                    <div className="border-t border-[#E2E8F0] pt-4 mt-2 flex flex-col gap-3" id="profile-visibility-section">
                      <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        Profile Visibility
                      </label>
                      <p className="text-[11px] text-slate-500 leading-normal font-medium">
                        Choose who can discover you and view your live location.
                      </p>

                      <div className="flex flex-col gap-2.5 mt-1">
                        {/* Public option */}
                        <button
                          type="button"
                          onClick={() => {
                            setMyProfile(prev => ({ ...prev, visibility: "public" }));
                            triggerAlert("Visibility set to Public Profile!", "success");
                          }}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                            myProfile.visibility === "public"
                              ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                          }`}
                          id="btn-visibility-public"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-blue-600" />
                              Public Profile
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              myProfile.visibility === "public" ? "bg-blue-200 text-blue-800" : "bg-slate-200 text-slate-600"
                            }`}>
                              Active
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 leading-normal font-medium flex flex-col gap-1">
                            <p><strong>Visibility:</strong> Public</p>
                            <p>• Your profile can appear to all nearby users.</p>
                            <p>• Your approximate location is visible to everyone within your selected radar radius.</p>
                            <p>• Any nearby user can send you a friend request or start a conversation.</p>
                            <p className="text-blue-700 font-semibold mt-0.5">• Best for meeting new people and expanding your network.</p>
                          </div>
                        </button>

                        {/* Private option */}
                        <button
                          type="button"
                          onClick={() => {
                            setMyProfile(prev => ({ ...prev, visibility: "private" }));
                            triggerAlert("Visibility set to Private Profile!", "success");
                          }}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                            myProfile.visibility === "private"
                              ? "border-amber-600 bg-amber-50 text-amber-950 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                          }`}
                          id="btn-visibility-private"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              Private Profile
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              myProfile.visibility === "private" ? "bg-amber-200 text-amber-800" : "bg-slate-200 text-slate-600"
                            }`}>
                              Active
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 leading-normal font-medium flex flex-col gap-1">
                            <p><strong>Visibility:</strong> Private</p>
                            <p>• Your profile and approximate location are visible only to your accepted friends.</p>
                            <p>• Nearby users who are not your friends cannot discover you on the radar.</p>
                          </div>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 1B. Share Local Story / Status Panel */}
                <div className={`col-span-12 lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "share" ? "flex" : "hidden"}`} id="share-story-panel">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-pink-600 animate-pulse" />
                      Share Local Story
                    </h3>
                    <span className="text-[10px] bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Instagram style</span>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    <form onSubmit={handlePostStory} className="flex flex-col gap-3.5">
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                          <span>Story Text Content</span>
                        </label>
                        <textarea
                          value={newStoryContent}
                          onChange={(e) => setNewStoryContent(e.target.value.substring(0, 120))}
                          placeholder="What's your story today? (Max 120 chars)"
                          rows={2}
                          className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-pink-500 w-full resize-none"
                          required
                        />
                        <span className="text-[8px] text-slate-400 font-bold text-right mt-0.5">
                          {newStoryContent.length}/120
                        </span>
                      </div>

                      {/* File Upload Area for Images and Videos */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-pink-500" />
                          <span>Attach Image or Video</span>
                        </label>
                        
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-3 hover:bg-slate-50 transition-all cursor-pointer group text-center">
                            <Plus className="w-4 h-4 text-slate-400 group-hover:text-pink-500 transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-pink-600 transition-colors mt-1">Upload File</span>
                            <span className="text-[8px] text-slate-400 font-medium">Image or Video max 2MB</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const isVideo = file.type.startsWith("video/");
                                const isImg = file.type.startsWith("image/");
                                if (!isVideo && !isImg) {
                                  triggerAlert("Please select an image or video file.", "error");
                                  return;
                                }
                                setStoryMediaFile(file);
                                setStoryMediaType(isVideo ? "video" : "image");
                                const previewUrl = URL.createObjectURL(file);
                                setStoryMediaPreview(previewUrl);
                                
                                if (file.size <= 2 * 1024 * 1024) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setStoryMediaUrl(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                } else {
                                  setStoryMediaUrl(previewUrl);
                                }
                                triggerAlert(`${file.name} attached successfully!`, "success");
                              }}
                            />
                          </label>

                          {/* Quick Unsplash / Mixkit Media Presets */}
                          <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Presets:</span>
                            <div className="grid grid-cols-2 gap-1">
                              {STORY_PRESET_MEDIA.slice(1, 5).map((p) => (
                                <button
                                  key={p.name}
                                  type="button"
                                  onClick={() => {
                                    setStoryMediaUrl(p.url);
                                    setStoryMediaType(p.type as any);
                                    setStoryMediaPreview(p.url);
                                    triggerAlert(`Preset "${p.name}" selected!`, "success");
                                  }}
                                  className="py-1 px-1.5 border border-slate-200 hover:border-pink-300 rounded text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-pink-50 transition-all truncate text-left"
                                  title={p.name}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Media Preview Window */}
                        {storyMediaPreview && (
                          <div className="relative mt-2 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 max-h-40 flex items-center justify-center p-1 group">
                            {storyMediaType === "video" ? (
                              <video
                                src={storyMediaPreview}
                                className="max-h-36 max-w-full rounded object-contain"
                                controls
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                src={storyMediaPreview}
                                alt="Preview"
                                className="max-h-36 max-w-full rounded object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setStoryMediaFile(null);
                                setStoryMediaUrl("");
                                setStoryMediaType(undefined);
                                setStoryMediaPreview("");
                                triggerAlert("Media attachment removed", "info");
                              }}
                              className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-colors cursor-pointer"
                              title="Remove media"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[8px] uppercase">
                              {storyMediaType} attachment
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Story privacy selector */}
                      <div className="flex flex-col gap-1 mt-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Who can view this story?</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => setNewStoryType("public")}
                            className={`py-1.5 px-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                              newStoryType === "public"
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                            id="btn-story-type-public"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            Global Public
                          </button>

                          <button
                            type="button"
                            onClick={() => setNewStoryType("nearby_public")}
                            className={`py-1.5 px-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                              newStoryType === "nearby_public"
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                            id="btn-story-type-nearby-public"
                          >
                            <Map className="w-2.5 h-2.5" />
                            Nearby Public
                          </button>

                          <button
                            type="button"
                            onClick={() => setNewStoryType("friends")}
                            className={`py-1.5 px-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                              newStoryType === "friends"
                                ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                            id="btn-story-type-friends"
                          >
                            <Users className="w-2.5 h-2.5" />
                            Friends
                          </button>

                          <button
                            type="button"
                            onClick={() => setNewStoryType("close_friends")}
                            className={`py-1.5 px-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                              newStoryType === "close_friends"
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                            id="btn-story-type-close-friends"
                          >
                            <Star className="w-2.5 h-2.5" />
                            Close Friends
                          </button>
                        </div>
                        
                        <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] text-slate-500 leading-normal font-medium">
                          {newStoryType === "public" && (
                            <p className="flex items-start gap-1">
                              <Globe className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                              <span><strong>Global Public:</strong> This post is published globally. <strong>Anyone using the app</strong> can discover and view it from their feed.</span>
                            </p>
                          )}
                          {newStoryType === "nearby_public" && (
                            <p className="flex items-start gap-1">
                              <Map className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                              <span><strong>Nearby Public:</strong> Broadcasted <strong>only to users located within your local radar area ({searchRadius} km)</strong>. Users outside your radius cannot view it.</span>
                            </p>
                          )}
                          {newStoryType === "friends" && (
                            <p className="flex items-start gap-1">
                              <Users className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                              <span><strong>Friends Scope:</strong> Private story shared <strong>only with your accepted friends</strong>. Non-friends won't see it on their feed.</span>
                            </p>
                          )}
                          {newStoryType === "close_friends" && (
                            <p className="flex items-start gap-1">
                              <Star className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5 fill-emerald-500" />
                              <span><strong>Close Friends Scope:</strong> Restricts viewing **only to friends** whom you have specifically starred in your Nearby People list.</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingStory || !newStoryContent.trim()}
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        id="btn-post-story-submit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Share Story
                      </button>
                    </form>
                  </div>
                </div>

                {/* 1B-2. Share Public Post Panel */}
                <div className={`col-span-12 lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm mt-6 ${mobileDemoTab === "share" ? "flex" : "hidden"}`} id="share-post-panel">
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      Create Public Post
                    </h3>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Twitter/X Style</span>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    <form onSubmit={handlePostSubmit} className="flex flex-col gap-3.5">
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                          <span>Post Text Content</span>
                        </label>
                        <textarea
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value.substring(0, 280))}
                          placeholder="What's on your mind? Share a persistent public post with nearby users or globally! (Max 280 chars)"
                          rows={3}
                          className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-blue-500 w-full resize-none"
                          required
                        />
                        <span className="text-[8px] text-slate-400 font-bold text-right mt-0.5">
                          {newPostContent.length}/280
                        </span>
                      </div>

                      {/* File Upload Area for Images and Videos */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-blue-500" />
                          <span>Attach Image or Video to Post</span>
                        </label>
                        
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-lg p-3 hover:bg-slate-50 transition-all cursor-pointer group text-center">
                            <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors mt-1">Upload File</span>
                            <span className="text-[8px] text-slate-400 font-medium">Image or Video max 2MB</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const isVideo = file.type.startsWith("video/");
                                const isImg = file.type.startsWith("image/");
                                if (!isVideo && !isImg) {
                                  triggerAlert("Please select an image or video file.", "error");
                                  return;
                                }
                                setPostMediaFile(file);
                                setPostMediaType(isVideo ? "video" : "image");
                                const previewUrl = URL.createObjectURL(file);
                                setPostMediaPreview(previewUrl);
                                
                                if (file.size <= 2 * 1024 * 1024) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setPostMediaUrl(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                } else {
                                  setPostMediaUrl(previewUrl);
                                }
                                triggerAlert(`${file.name} attached to post successfully!`, "success");
                              }}
                            />
                          </label>

                          {/* Quick Unsplash / Mixkit Media Presets */}
                          <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Presets:</span>
                            <div className="grid grid-cols-2 gap-1">
                              {STORY_PRESET_MEDIA.slice(1, 5).map((p) => (
                                <button
                                  key={`post-preset-${p.name}`}
                                  type="button"
                                  onClick={() => {
                                    setPostMediaUrl(p.url);
                                    setPostMediaType(p.type as any);
                                    setPostMediaPreview(p.url);
                                    triggerAlert(`Preset "${p.name}" selected for post!`, "success");
                                  }}
                                  className="py-1 px-1.5 border border-slate-200 hover:border-blue-300 rounded text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 transition-all truncate text-left"
                                  title={p.name}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Media Preview Window */}
                        {postMediaPreview && (
                          <div className="relative mt-2 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 max-h-40 flex items-center justify-center p-1 group">
                            {postMediaType === "video" ? (
                              <video
                                src={postMediaPreview}
                                className="max-h-36 max-w-full rounded object-contain"
                                controls
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                src={postMediaPreview}
                                alt="Post Preview"
                                className="max-h-36 max-w-full rounded object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                  setPostMediaFile(null);
                                  setPostMediaUrl("");
                                  setPostMediaType(undefined);
                                  setPostMediaPreview("");
                                  triggerAlert("Post media attachment removed", "info");
                              }}
                              className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-colors cursor-pointer"
                              title="Remove post media"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[8px] uppercase">
                              {postMediaType} attachment
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Post Scope & Expiration */}
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Post Visibility</label>
                          <div className="flex gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => setNewPostType("public")}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                newPostType === "public"
                                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <Globe className="w-2.5 h-2.5" />
                              Global
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewPostType("nearby_public")}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                newPostType === "nearby_public"
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <Map className="w-2.5 h-2.5" />
                              Nearby
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Auto-Expire Post</label>
                          <select
                            value={newPostExpiration}
                            onChange={(e) => setNewPostExpiration(Number(e.target.value))}
                            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#1E293B] focus:outline-none focus:border-blue-500 w-full mt-1 h-[30px]"
                          >
                            <option value={0}>Never Expire</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={72}>3 Days</option>
                            <option value={168}>7 Days</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] text-slate-500 leading-normal font-medium">
                        {newPostType === "public" ? (
                          <p className="flex items-start gap-1">
                            <Globe className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                            <span><strong>Global Post:</strong> Visible on the Global Posts Timeline to everyone. Will {newPostExpiration > 0 ? `expire in ${newPostExpiration} hours.` : "never expire."}</span>
                          </p>
                        ) : (
                          <p className="flex items-start gap-1">
                            <Map className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                            <span><strong>Nearby Post:</strong> Broadcasted only to users within {searchRadius} km. Will {newPostExpiration > 0 ? `expire in ${newPostExpiration} hours.` : "never expire."}</span>
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingPost || !newPostContent.trim()}
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        id="btn-publish-post-submit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Publish Post
                      </button>
                    </form>
                  </div>
                </div>

                {/* 1C. Share Section Friends List (Visible on Share Tab on mobile & laptop) */}
                {mobileDemoTab === "share" && (
                  <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm" id="share-section-friends">
                    <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-pink-600" />
                        Friends List ({nearbyPeople.filter(p => p.status === "accepted").length})
                      </h3>
                      <span className="text-[9px] bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Share Targets</span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      {nearbyPeople.filter(p => p.status === "accepted").length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">
                          <p className="font-semibold mb-1">No friends added yet.</p>
                          <p className="text-[10px] text-slate-400">Discover and connect with nearby people on the Radar first!</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto">
                          {nearbyPeople.filter(p => p.status === "accepted").map(person => (
                            <div key={person.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <div className="relative">
                                  <img src={person.avatar} alt={person.name} className="w-9 h-9 rounded-lg border border-slate-200 object-contain" referrerPolicy="no-referrer" />
                                  {person.online && (
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] rounded-full border-2 border-white"></span>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 leading-tight">{person.name}</h4>
                                  <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{person.bio || "Active friend"}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveChatId(person.id);
                                  setMobileShowInbox(false);
                                  setMobileDemoTab("chat");
                                  triggerAlert(`Opened conversation with ${person.name}!`, "success");
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-[#2563EB] hover:bg-blue-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" /> Chat
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Joined Communities Feed Channels Panel */}
                <div className={`col-span-12 lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "friends" ? "flex" : "hidden"}`}>
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
                                setMobileShowInbox(false);
                                setMobileDemoTab("chat");
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

              {/* Stories Tray Section */}
                
                {/* 2A. Instagram-like Stories Tray */}
                <div className={`col-span-12 bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col gap-5 shadow-sm ${(mobileDemoTab === "radar" || mobileDemoTab === "share") ? "flex" : "hidden"}`} id="stories-tray-panel">
                  
                  {/* Row 1: Public Stories Feed */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-extrabold text-[#2563EB] uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                        Public Stories Feed (Instagram-style)
                      </span>
                      <span className="text-[9px] bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        24h Expiring
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start">
                      <button
                        type="button"
                        onClick={() => setPublicPostsScope("nearby")}
                        className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          publicPostsScope === "nearby"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#1E293B]"
                        }`}
                      >
                        Nearby Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublicPostsScope("global")}
                        className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          publicPostsScope === "global"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#1E293B]"
                        }`}
                      >
                        Global Public
                      </button>
                    </div>

                    {radarStories.length === 0 ? (
                      <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-[11px] font-medium">
                        No public stories in {publicPostsScope === "nearby" ? "your nearby area" : "the app"} yet.
                      </div>
                    ) : (
                      <div className="flex items-center gap-3.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {(() => {
                          const groups: { [userId: string]: { userName: string; avatar: string; stories: Story[] } } = {};
                          radarStories.forEach(s => {
                            if (!groups[s.userId]) {
                              groups[s.userId] = {
                                userName: s.userName,
                                avatar: s.avatar,
                                stories: []
                              };
                            }
                            groups[s.userId].stories.push(s);
                          });

                          return Object.entries(groups).map(([userId, group]) => {
                            const isOwn = userId === myProfile.id;
                            return (
                              <button
                                key={`public-story-${userId}`}
                                onClick={() => {
                                  setCurrentStoryIndex(0);
                                  setIsStoryPaused(false);
                                  setActiveStoryGroup(group);
                                }}
                                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg p-0.5"
                                title={`View ${group.userName}'s public stories`}
                              >
                                <div className="relative">
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600">
                                    <div className="w-full h-full rounded-full bg-white p-[2px]">
                                      <img 
                                        src={group.avatar} 
                                        alt={group.userName} 
                                        className="w-full h-full rounded-full object-contain bg-slate-50"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>
                                  <span className="absolute -bottom-1 -right-1 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full text-white font-extrabold border border-white bg-blue-600">
                                    {group.stories.length}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[65px]">
                                  {isOwn ? "Your Story" : group.userName}
                                </span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Friends & Private Stories Feed */}
                  <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        Private & Friends Stories Feed
                      </span>
                    </div>

                    {shareStories.length === 0 ? (
                      <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-[11px] font-medium">
                        No private or friends-only stories shared yet.
                      </div>
                    ) : (
                      <div className="flex items-center gap-3.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {(() => {
                          const groups: { [userId: string]: { userName: string; avatar: string; stories: Story[] } } = {};
                          shareStories.forEach(s => {
                            if (!groups[s.userId]) {
                              groups[s.userId] = {
                                userName: s.userName,
                                avatar: s.avatar,
                                stories: []
                              };
                            }
                            groups[s.userId].stories.push(s);
                          });

                          return Object.entries(groups).map(([userId, group]) => {
                            const hasCloseFriendsStory = group.stories.some(s => s.type === "close_friends");
                            const isOwn = userId === myProfile.id;
                            return (
                              <button
                                key={`private-story-${userId}`}
                                onClick={() => {
                                  setCurrentStoryIndex(0);
                                  setIsStoryPaused(false);
                                  setActiveStoryGroup(group);
                                }}
                                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg p-0.5"
                                title={`View ${group.userName}'s private stories`}
                              >
                                <div className="relative">
                                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-[2.5px] ${
                                    hasCloseFriendsStory
                                      ? "bg-gradient-to-tr from-green-400 via-emerald-500 to-teal-600"
                                      : "bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500"
                                  }`}>
                                    <div className="w-full h-full rounded-full bg-white p-[2px]">
                                      <img 
                                        src={group.avatar} 
                                        alt={group.userName} 
                                        className="w-full h-full rounded-full object-contain bg-slate-50"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>
                                  <span className={`absolute -bottom-1 -right-1 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full text-white font-extrabold border border-white ${
                                    hasCloseFriendsStory ? "bg-emerald-600" : "bg-amber-600"
                                  }`}>
                                    {group.stories.length}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[65px]">
                                  {isOwn ? "Your Story" : group.userName}
                                </span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                </div>

                {/* Brand New: Interactive Live Social Radar Sweep Map Card */}
                {mobileDemoTab === "radar" && (
                  <div className="col-span-12 lg:col-span-6 bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl animate-fade-in" id="radar-sweep-dashboard">
                    {/* Header */}
                    <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                          Interactive Live Social Radar
                        </h3>
                      </div>
                      <span className="flex items-center gap-1.5 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                        Live Sweep
                      </span>
                    </div>

                    <div className="p-4 flex flex-col gap-4 flex-1 justify-between min-h-[440px]">
                      {/* Interactive Radar Screen Visualization */}
                      <div className="relative w-full aspect-square max-h-[340px] mx-auto bg-[#090C15] border border-slate-800 rounded-full flex items-center justify-center overflow-hidden shadow-inner shadow-slate-950">
                        {/* Radar Concentric Rings */}
                        <div className="absolute w-[90%] h-[90%] border border-emerald-500/5 rounded-full"></div>
                        <div className="absolute w-[70%] h-[70%] border border-emerald-500/10 rounded-full"></div>
                        <div className="absolute w-[50%] h-[50%] border border-emerald-500/15 rounded-full"></div>
                        <div className="absolute w-[30%] h-[30%] border border-emerald-500/20 rounded-full"></div>
                        
                        {/* Axis crosshairs */}
                        <div className="absolute w-full h-[0.5px] bg-emerald-500/10"></div>
                        <div className="absolute h-full w-[0.5px] bg-emerald-500/10"></div>
                        
                        {/* Rotating Sweep Beam */}
                        <div className="absolute inset-0 origin-center animate-spin-slow" style={{ animationDuration: '6s', backgroundImage: 'conic-gradient(from 0deg, transparent 50%, rgba(16, 185, 129, 0.15) 100%)' }}></div>

                        {/* User representation at dead center */}
                        <div className="absolute z-20 w-10 h-10 rounded-full p-[2px] bg-emerald-500 shadow-lg shadow-emerald-500/30 animate-pulse">
                          <img 
                            src={avatarUrl} 
                            alt="Me" 
                            className="w-full h-full rounded-full bg-slate-950 border border-slate-900 object-contain"
                            referrerPolicy="no-referrer" 
                          />
                        </div>

                        {/* Interactive Nearby Nodes */}
                        {nearbyPeople.filter(p => p.distance <= searchRadius && p.online !== false).map((person) => {
                          const { x, y } = getCoordinates(person.id, person.distance);
                          const isFriend = person.status === "accepted";
                          const isPending = person.status === "pending";
                          const isSelected = selectedRadarTarget?.id === person.id;
                          return (
                            <button
                              key={person.id}
                              onClick={() => setSelectedRadarTarget({ ...person, type: 'person' })}
                              className="absolute z-30 group cursor-pointer focus:outline-none"
                              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                              {/* Pulse Ring */}
                              <span className={`absolute -inset-1.5 rounded-full animate-ping opacity-60 ${
                                isFriend ? "bg-emerald-500" : isPending ? "bg-amber-500" : "bg-blue-500"
                              }`}></span>
                              {/* Glowing Target Dot */}
                              <div className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg transition-transform hover:scale-125 ${
                                isFriend ? "bg-emerald-400" : isPending ? "bg-amber-400" : "bg-blue-400"
                              } ${isSelected ? "ring-2 ring-white scale-125" : ""}`}></div>
                              
                              {/* Quick Mini Label on Hover */}
                              <span className="absolute left-1/2 -translate-x-1/2 -top-6 bg-slate-900/90 text-[9px] font-bold text-white px-1.5 py-0.5 rounded border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-40">
                                {person.name} ({person.distance.toFixed(1)} km)
                              </span>
                            </button>
                          );
                        })}

                        {/* Interactive Communities Nodes */}
                        {communities.filter(c => c.distance <= searchRadius).map((comm) => {
                          const { x, y } = getCoordinates(comm.id, comm.distance);
                          const isSelected = selectedRadarTarget?.id === comm.id;
                          return (
                            <button
                              key={comm.id}
                              onClick={() => setSelectedRadarTarget({ ...comm, type: 'community' })}
                              className="absolute z-30 group cursor-pointer focus:outline-none"
                              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                            >
                              {/* Pulse Ring */}
                              <span className={`absolute -inset-1.5 rounded-full animate-ping opacity-50 bg-indigo-500`}></span>
                              {/* Glowing Target Dot (Pinkish-Indigo for community channels!) */}
                              <div className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg transition-transform hover:scale-125 bg-indigo-400 ${isSelected ? "ring-2 ring-white scale-125" : ""}`}>
                                <span className="text-[7px] font-black text-slate-950">📢</span>
                              </div>
                              
                              {/* Quick Mini Label on Hover */}
                              <span className="absolute left-1/2 -translate-x-1/2 -top-6 bg-slate-900/90 text-[9px] font-bold text-white px-1.5 py-0.5 rounded border border-indigo-500 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-40">
                                {comm.name} ({comm.distance.toFixed(1)} km)
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Node Details Panel overlay inside card */}
                      {selectedRadarTarget ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img 
                              src={selectedRadarTarget.avatar || "https://api.dicebear.com/7.x/identicon/svg?seed=" + selectedRadarTarget.id} 
                              alt={selectedRadarTarget.name} 
                              className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-950 object-contain shrink-0" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-white flex items-center gap-1 truncate">
                                {selectedRadarTarget.name}
                                {selectedRadarTarget.type === 'community' && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.5 rounded">Group</span>}
                              </h4>
                              <p className="text-[9px] text-slate-400 font-bold truncate max-w-[150px] mt-0.5">
                                {selectedRadarTarget.type === 'community' 
                                  ? `${selectedRadarTarget.membersCount || 1} Members • ${selectedRadarTarget.distance.toFixed(1)} km away` 
                                  : `${selectedRadarTarget.bio || "Active node"} • ${selectedRadarTarget.distance.toFixed(1)} km away`
                                }
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-1.5 shrink-0">
                            {selectedRadarTarget.type === 'community' ? (
                              joinedCommunities.includes(selectedRadarTarget.id) ? (
                                <button
                                  onClick={() => {
                                    setActiveChatId(selectedRadarTarget.id);
                                    setMobileShowInbox(false);
                                    setMobileDemoTab("chat");
                                    triggerAlert(`Opened group channel ${selectedRadarTarget.name}!`, "success");
                                  }}
                                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" /> Feed
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleJoinCommunity(selectedRadarTarget.id)}
                                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Join
                                </button>
                              )
                            ) : (
                              selectedRadarTarget.status === "accepted" ? (
                                <button
                                  onClick={() => {
                                    setActiveChatId(selectedRadarTarget.id);
                                    setMobileShowInbox(false);
                                    setMobileDemoTab("chat");
                                    triggerAlert(`Opened chat with ${selectedRadarTarget.name}!`, "success");
                                  }}
                                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" /> Message
                                </button>
                              ) : selectedRadarTarget.status === "sent" ? (
                                <span className="px-2 py-1.5 text-[8px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                  Sent
                                </span>
                              ) : selectedRadarTarget.status === "received" ? (
                                <button
                                  onClick={() => {
                                    handleAcceptRequest(selectedRadarTarget.id);
                                    triggerAlert(`Connected with ${selectedRadarTarget.name}!`, "success");
                                  }}
                                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  Accept
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendRequest(selectedRadarTarget.id)}
                                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  Connect
                                </button>
                              )
                            )}
                            <button 
                              onClick={() => setSelectedRadarTarget(null)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 text-center text-[10px] text-slate-400 leading-relaxed font-bold">
                          🛰️ <strong>Interactive Radar active:</strong> Click on any pulsing signal targets on the sector map to identify and connect with nearby citizens or local groups!
                        </div>
                      )}

                      {/* Radar scope Controls */}
                      <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                            Search Radius Scope
                          </span>
                          <span className="text-xs font-black text-emerald-400">{searchRadius} km</span>
                        </div>
                        <input 
                          type="range" 
                          min={1} 
                          max={50} 
                          value={searchRadius}
                          onChange={(e) => {
                            setSearchRadius(Number(e.target.value));
                            triggerAlert(`Radar range expanded to ${e.target.value} km! Scanning...`, "info");
                          }}
                          className="w-full accent-emerald-500 bg-slate-800 h-1 rounded-lg appearance-none cursor-pointer mt-1"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-bold mt-1">
                          <span>1 km</span>
                          <span>25 km</span>
                          <span>50 km</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Posts Feed Section */}
                <div className={`col-span-12 lg:col-span-6 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "radar" ? "flex" : "hidden"}`}>
                  <div className="bg-[#F8FAFC] px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E293B] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                      Public Posts Timeline
                    </h3>
                    <div className="flex bg-[#F1F5F9] rounded-lg p-0.5 border border-[#E2E8F0]">
                      <button
                        onClick={() => setPublicPostsScope("nearby")}
                        className={`py-1 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                          publicPostsScope === "nearby"
                            ? "bg-white text-[#1E293B] shadow-sm"
                            : "text-[#64748B] hover:text-[#1E293B]"
                        }`}
                      >
                        <Map className="w-2.5 h-2.5" />
                        Nearby
                      </button>
                      <button
                        onClick={() => setPublicPostsScope("global")}
                        className={`py-1 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                          publicPostsScope === "global"
                            ? "bg-white text-[#1E293B] shadow-sm"
                            : "text-[#64748B] hover:text-[#1E293B]"
                        }`}
                      >
                        <Globe className="w-2.5 h-2.5" />
                        Global
                      </button>
                    </div>
                  </div>

                  {/* Search and Category filters for Public Posts Timeline */}
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] p-3 flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search posts by keyword..."
                        value={postsSearchQuery}
                        onChange={(e) => {
                          setPostsSearchQuery(e.target.value);
                          setVisiblePostsCount(5); // reset lazy loading on filter change
                        }}
                        className="bg-white border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#2563EB] w-full"
                      />
                    </div>
                    <select
                      value={postsCategoryFilter}
                      onChange={(e) => {
                        setPostsCategoryFilter(e.target.value);
                        setVisiblePostsCount(5); // reset lazy loading on filter change
                      }}
                      className="bg-white border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs font-bold text-[#1E293B] cursor-pointer focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="all">All Content Types</option>
                      <option value="text">Text Only</option>
                      <option value="image">Images</option>
                      <option value="video">Videos</option>
                    </select>
                  </div>

                  <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[720px] scrollbar-thin">
                    {radarPosts.length === 0 ? (
                      <div className="text-center py-10 bg-[#F8FAFC] rounded-lg border border-dashed border-[#E2E8F0] p-6 text-slate-500 text-xs font-semibold flex flex-col items-center justify-center gap-2">
                        <MessageSquare className="w-8 h-8 text-slate-300" />
                        <p>No public posts matching filters yet.</p>
                        <button
                          onClick={() => setMobileDemoTab("share")}
                          className="mt-2 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                        >
                          Create First Post
                        </button>
                      </div>
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout">
                          {radarPosts.slice(0, visiblePostsCount).map((post) => {
                            const isOwn = post.userId === myProfile.id;
                            const hasLiked = post.likes?.includes(myProfile.id);
                            const hasReported = post.reports?.includes(myProfile.id);
                            return (
                              <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.25 }}
                                className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow flex flex-col"
                              >
                                {/* Header: Senders info top */}
                                <div className="px-4 py-3 bg-[#F8FAFC]/50 border-b border-[#F1F5F9] flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={post.avatar}
                                      alt={post.userName}
                                      className="w-8 h-8 rounded-full border border-slate-200"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div>
                                      <span className="text-xs font-bold text-slate-800 block leading-tight">{post.userName}</span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[9px] text-slate-400 font-medium">
                                          {post.timestamp instanceof Date 
                                            ? post.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                                            : new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[9px] text-slate-300">•</span>
                                        {post.type === "global" || post.type === "public" ? (
                                          <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <Globe className="w-2 h-2" />
                                            Global
                                          </span>
                                        ) : (
                                          <span className="text-[8px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <Map className="w-2 h-2" />
                                            Nearby
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {isOwn ? (
                                    <button
                                      onClick={() => handleDeletePost(post.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                      title="Delete post"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReportPost(post.id)}
                                      className={`p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer ${
                                        hasReported ? "text-rose-600 font-extrabold" : ""
                                      }`}
                                      title={hasReported ? "Flagged/Reported" : "Report Post"}
                                    >
                                      <Flag className={`w-3.5 h-3.5 ${hasReported ? "fill-rose-600 text-rose-600 animate-pulse" : ""}`} />
                                    </button>
                                  )}
                                </div>

                                {/* Description: Given below sender info */}
                                <div className="px-4 py-3 text-xs text-slate-700 font-medium leading-relaxed break-words whitespace-pre-wrap">
                                  {post.content}
                                </div>

                                {/* Post Image: Attached below description, span full width */}
                                {post.mediaUrl && (
                                  <div className="w-full bg-[#F8FAFC] border-t border-[#F1F5F9] max-h-96 overflow-hidden flex items-center justify-center">
                                    {post.mediaType === "video" ? (
                                      <video
                                        src={post.mediaUrl}
                                        className="w-full h-auto object-contain max-h-96"
                                        controls
                                        playsInline
                                        muted
                                      />
                                    ) : (
                                      <img
                                        src={post.mediaUrl}
                                        alt="Post media"
                                        className="w-full h-auto object-contain max-h-96"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Footer: Likes and Lifetime */}
                                <div className="px-4 py-2.5 bg-[#F8FAFC]/30 border-t border-[#F1F5F9] flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                  <button
                                    onClick={() => handleToggleLike(post.id)}
                                    className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                                      hasLiked 
                                        ? "bg-rose-50 text-rose-600 font-bold" 
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    <Heart className={`w-3.5 h-3.5 ${hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                                    <span>{post.likes?.length || 0} Likes</span>
                                  </button>

                                  <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                    <Clock className="w-3 h-3 text-slate-300" />
                                    <span>
                                      {post.expirationHours && post.expirationHours > 0
                                        ? `Expires in ${post.expirationHours}h`
                                        : "Persistent (Never expires)"}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Intersection Observer target for lazy loading */}
                        {radarPosts.length > visiblePostsCount && (
                          <div ref={postsEndRef} className="py-4 text-center text-[10px] text-slate-400 font-bold animate-pulse">
                            Loading older public posts...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Nearby People list matchcards */}
                <div className={`col-span-12 lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "friends" ? "flex" : "hidden"}`}>
                  <div className="bg-[#F1F5F9] px-4 py-3 border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <span>Local Matches Radar</span>
                    <span className="text-[10px] bg-[#EFF6FF] text-[#1E40AF] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Filtered</span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Search Friends Field (Local Matches Radar) */}
                    <div className="flex flex-col gap-1.5 border-b border-[#E2E8F0] pb-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                        <Search className="w-3.5 h-3.5 text-[#2563EB]" />
                        Search Friends / ID:
                      </label>
                      <input
                        type="text"
                        placeholder="Enter username or ID to search..."
                        value={searchFriendsQuery}
                        onChange={(e) => setSearchFriendsQuery(e.target.value)}
                        className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#2563EB] w-full"
                      />
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
                                <div className="flex gap-1.5 items-center">
                                  <button
                                    id={`btn-chat-with-${person.id}`}
                                    onClick={() => {
                                      setActiveChatId(person.id);
                                      setMobileShowInbox(false);
                                      setMobileDemoTab("chat");
                                      triggerAlert(`Opened chat with ${person.name}`, "success");
                                    }}
                                    className={`font-bold py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all flex-1 ${
                                      activeChatId === person.id 
                                        ? "bg-[#1E293B] text-white" 
                                        : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                                    }`}
                                  >
                                    Chat Open
                                  </button>
                                  <button
                                    id={`btn-toggle-close-friend-${person.id}`}
                                    onClick={() => toggleCloseFriend(person.id)}
                                    className={`p-1.5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                                      closeFriendIds.includes(person.id)
                                        ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300 shadow-sm"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200"
                                    }`}
                                    title={closeFriendIds.includes(person.id) ? "Close Friend (Starred)" : "Add to Close Friends"}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${closeFriendIds.includes(person.id) ? "fill-emerald-500 text-emerald-600 animate-pulse" : "text-slate-400"}`} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Local interest-based communities listed */}
                <div className={`col-span-12 lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm ${mobileDemoTab === "friends" ? "flex" : "hidden"}`}>
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


              {/* Split-screen Inbox & Chat Window Container (col-span-12) */}
              <div className={`col-span-12 max-w-5xl mx-auto w-full flex h-[calc(100vh-175px)] md:h-[550px] max-h-[75vh] bg-white rounded-xl border border-[#E2E8F0] shadow-sm relative overflow-hidden ${mobileDemoTab === "chat" ? "flex" : "hidden"}`} id="chat-window">
                
                {/* LEFT SIDEBAR: Inbox Conversations list */}
                <div className={`${mobileShowInbox ? "flex" : "hidden md:flex"} flex-col w-full md:w-80 border-r border-[#E2E8F0] bg-[#F8FAFC] h-full shrink-0`} id="inbox-sidebar">
                  {/* Sidebar Title */}
                  <div className="px-4 py-3 bg-[#F1F5F9] border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                      My Inbox
                    </h3>
                    <span className="text-[9px] bg-blue-100 text-[#1E40AF] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {nearbyPeople.filter(p => p.status === "accepted" && p.online).length} Active
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="p-2 border-b border-[#E2E8F0] bg-white shrink-0">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Search chats..." 
                        value={inboxSearchQuery}
                        onChange={(e) => setInboxSearchQuery(e.target.value)}
                        className="w-full bg-[#F1F5F9] border border-transparent rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] font-bold text-[#1E293B] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  {/* Conversations List */}
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                    {/* 1. Linky AI Assistant Item */}
                    {("Linky AI Assistant".toLowerCase().includes(inboxSearchQuery.toLowerCase()) || "Gemini".toLowerCase().includes(inboxSearchQuery.toLowerCase())) && (
                      <button
                        onClick={() => {
                          setActiveChatId("ai-assistant");
                          setMobileShowInbox(false);
                        }}
                        className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                          activeChatId === "ai-assistant" 
                            ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF] shadow-sm font-bold" 
                            : "bg-white hover:bg-slate-50 border-[#E2E8F0] text-slate-700 font-bold"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-base font-bold shadow-sm border border-blue-400/20">
                              🤖
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] rounded-full border-2 border-white"></span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold truncate leading-tight">Linky AI Assistant</h4>
                            <p className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              Active now
                            </p>
                          </div>
                        </div>
                      </button>
                    )}

                    {/* 2. Friends Conversations Items */}
                    {nearbyPeople
                      .filter(p => p.status === "accepted")
                      .filter(p => p.name.toLowerCase().includes(inboxSearchQuery.toLowerCase()))
                      .map(person => {
                        const isSelected = activeChatId === person.id;
                        const latestMsg = conversations[person.id]?.[conversations[person.id].length - 1];
                        return (
                          <button
                            key={person.id}
                            onClick={() => {
                              setActiveChatId(person.id);
                              setMobileShowInbox(false);
                            }}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isSelected 
                                ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF] shadow-sm font-bold" 
                                : "bg-white hover:bg-slate-50 border-[#E2E8F0] text-slate-700 font-bold"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 w-full">
                              <div className="relative shrink-0">
                                <img src={person.avatar} alt={person.name} className="w-9 h-9 rounded-lg border border-slate-200 object-contain bg-slate-50" referrerPolicy="no-referrer" />
                                {person.online && (
                                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] rounded-full border-2 border-white"></span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-extrabold truncate leading-tight text-slate-800">{person.name}</h4>
                                  {latestMsg && (
                                    <span className="text-[8px] font-medium text-slate-400 shrink-0">{latestMsg.timestamp}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                  {latestMsg ? latestMsg.text : "No messages yet"}
                                </p>
                                <p className={`text-[9px] font-bold mt-0.5 flex items-center gap-1 ${person.online ? "text-emerald-600" : "text-slate-400"}`}>
                                  <span className={`w-1 h-1 rounded-full ${person.online ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></span>
                                  {person.online ? "Active now" : "Offline"}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                    {/* 3. Joined Community Group Items */}
                    {joinedCommunities
                      .map(id => communities.find(c => c.id === id))
                      .filter((c): c is NonNullable<typeof c> => !!c)
                      .filter(c => c.name.toLowerCase().includes(inboxSearchQuery.toLowerCase()))
                      .map(comm => {
                        const isSelected = activeChatId === comm.id;
                        const latestMsg = conversations[comm.id]?.[conversations[comm.id].length - 1];
                        return (
                          <button
                            key={comm.id}
                            onClick={() => {
                              setActiveChatId(comm.id);
                              setMobileShowInbox(false);
                            }}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isSelected 
                                ? "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF] shadow-sm font-bold" 
                                : "bg-white hover:bg-slate-50 border-[#E2E8F0] text-slate-700 font-bold"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 w-full">
                              <div className="p-1.5 rounded-lg bg-indigo-50 text-[#1E40AF] shrink-0 border border-indigo-100 flex items-center justify-center w-9 h-9">
                                {comm.icon === "Code" && <Code className="w-4 h-4" />}
                                {comm.icon === "Trophy" && <Trophy className="w-4 h-4" />}
                                {comm.icon === "Camera" && <Camera className="w-4 h-4" />}
                                {comm.icon === "BookOpen" && <BookOpen className="w-4 h-4" />}
                                {comm.icon === "Music" && <Music className="w-4 h-4" />}
                                {!["Code", "Trophy", "Camera", "BookOpen", "Music"].includes(comm.icon || "") && "📢"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-extrabold truncate leading-tight text-slate-800">{comm.name}</h4>
                                  {latestMsg && (
                                    <span className="text-[8px] font-medium text-slate-400 shrink-0">{latestMsg.timestamp}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                  {latestMsg ? latestMsg.text : "No messages yet"}
                                </p>
                                <p className="text-[9px] text-[#4F46E5] font-bold mt-0.5 flex items-center gap-1">
                                  <span>📢</span> Group Channel
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* RIGHT CHAT WINDOW PORT: Active chat pane */}
                <div className={`${mobileShowInbox ? "hidden md:flex" : "flex"} flex-1 flex-col h-full bg-white relative overflow-hidden min-w-0`} id="active-chat-pane">
                  
                  {/* 1. Header of conversation (contact info + calls + actions) */}
                  <div className="bg-[#F1F5F9] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      {/* Back button for mobile */}
                      <button
                        onClick={() => setMobileShowInbox(true)}
                        className="flex md:hidden p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors mr-1 cursor-pointer shrink-0"
                        title="Back to Inbox"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
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
                 <div ref={chatMessagesContainerRef} className="flex-1 p-4 overflow-y-auto bg-[#F8FAFC] flex flex-col gap-3.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent relative" style={customTheme.chatWallpaper ? { backgroundImage: `url(${customTheme.chatWallpaper})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
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
                               onClick={(e) => {
                                  // Don't toggle if clicking buttons inside the toolbar
                                  if ((e.target as HTMLElement).closest(".message-toolbar")) return;
                                  setActiveMessageToolbarId(prev => prev === msg.id ? null : msg.id);
                                }}
                                className={`p-3 rounded-xl shadow-sm text-xs leading-relaxed relative group transition-all cursor-pointer ${
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
                                     Translated ({msg.targetLangName || "Spanish"}):
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
 
                               {/* Quick Reactions & Actions Toolbar (visible on click/tap and hover) */}
                               <div 
                                 className={`message-toolbar absolute bottom-full mb-1.5 left-1/2 transform -translate-x-1/2 md:bottom-auto md:top-0 md:translate-x-0 flex items-center gap-1.5 p-1.5 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-30 transition-all ${
                                   activeMessageToolbarId === msg.id 
                                     ? "opacity-100 scale-100 pointer-events-auto visible" 
                                     : "opacity-0 scale-95 pointer-events-none invisible md:group-hover:opacity-100 md:group-hover:scale-100 md:group-hover:pointer-events-auto md:group-hover:visible"
                                 } ${
                                   isMe ? "md:left-auto md:right-full md:-translate-x-0 md:mr-2" : "md:right-auto md:left-full md:-translate-x-0 md:ml-2"
                                 }`}
                               >
                                 {showLangMenuMsgId === msg.id ? (
                                   /* Translation Language Selection Menu */
                                   <div className="flex items-center gap-1">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setShowLangMenuMsgId(null);
                                       }}
                                       className="p-1 hover:bg-slate-100 rounded text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
                                       title="Back"
                                     >
                                       <ArrowLeft className="w-3 h-3" />
                                     </button>
                                     <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mr-1 select-none">To:</span>
                                     <div className="flex items-center gap-1 flex-nowrap overflow-x-auto max-w-[150px] md:max-w-[180px] scrollbar-none">
                                       {[
                                         { code: "hi", name: "Hindi 🇮🇳" },
                                         { code: "en", name: "English 🇺🇸" },
                                         { code: "es", name: "Spanish 🇪🇸" },
                                         { code: "ja", name: "Japanese 🇯🇵" }
                                       ].map((lang) => (
                                         <button
                                           key={lang.code}
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleTranslateMessage(msg.id, msg.text, lang.code, lang.name);
                                             setShowLangMenuMsgId(null);
                                             setActiveMessageToolbarId(null);
                                           }}
                                           className="px-2 py-0.5 text-[9px] font-bold bg-[#EFF6FF] border border-blue-200 text-[#1E40AF] rounded-md hover:bg-blue-100 transition-all shrink-0 cursor-pointer"
                                         >
                                           {lang.name}
                                         </button>
                                       ))}
                                     </div>
                                   </div>
                                 ) : (
                                   /* Standard Reactions and Tools Row */
                                   <>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleReaction(msg.id, "👍");
                                         setActiveMessageToolbarId(null);
                                       }}
                                       className="hover:scale-125 transition-transform cursor-pointer"
                                       title="Like"
                                     >
                                       👍
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleReaction(msg.id, "❤️");
                                         setActiveMessageToolbarId(null);
                                       }}
                                       className="hover:scale-125 transition-transform cursor-pointer"
                                       title="Love"
                                     >
                                       ❤️
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleReaction(msg.id, "🔥");
                                         setActiveMessageToolbarId(null);
                                       }}
                                       className="hover:scale-125 transition-transform cursor-pointer"
                                       title="Fire"
                                     >
                                       🔥
                                     </button>
                                     
                                     <div className="w-px h-3 bg-slate-200 mx-1"></div>
 
                                     {/* Instant Translate Choice Button */}
                                     {msg.type === "text" && !msg.translation && (
                                       <button
                                         id={`btn-translate-msg-${msg.id}`}
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setShowLangMenuMsgId(msg.id);
                                         }}
                                         className="p-1 text-slate-500 hover:text-[#2563EB] cursor-pointer rounded hover:bg-slate-50"
                                         title="Choose translation language"
                                       >
                                         <Languages className="w-3.5 h-3.5" />
                                       </button>
                                     )}
 
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleDeleteMessage(msg.id);
                                         setActiveMessageToolbarId(null);
                                       }}
                                       className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded hover:bg-slate-50"
                                       title="Delete message"
                                     >
                                       <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                   </>
                                 )}
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

                    {/* Stickers and GIFs Tray */}
                    {showStickersAndGifs && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2.5 shadow-inner transition-all">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setStickersAndGifsTab("stickers")}
                              className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                stickersAndGifsTab === "stickers" 
                                  ? "bg-indigo-600 text-white shadow-sm" 
                                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                              }`}
                            >
                              Stickers
                            </button>
                            <button
                              type="button"
                              onClick={() => setStickersAndGifsTab("gifs")}
                              className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                stickersAndGifsTab === "gifs" 
                                  ? "bg-indigo-600 text-white shadow-sm" 
                                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                              }`}
                            >
                              GIFs
                            </button>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Click to send instantly</span>
                        </div>

                        {stickersAndGifsTab === "stickers" ? (
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                            {STICKERS_LIST.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleSendStickerOrGif(st.url, "sticker")}
                                className="p-1 bg-white hover:bg-indigo-50 border border-slate-150 rounded-lg hover:scale-105 transition-all duration-150 flex flex-col items-center gap-1 cursor-pointer"
                                title={st.name}
                              >
                                <img src={st.url} alt={st.name} className="w-10 h-10 object-contain pointer-events-none" referrerPolicy="no-referrer" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                            {GIFS_LIST.map((gf) => (
                              <button
                                key={gf.id}
                                type="button"
                                onClick={() => handleSendStickerOrGif(gf.url, "gif")}
                                className="p-1 bg-white hover:bg-indigo-50 border border-slate-150 rounded-lg hover:scale-105 transition-all duration-150 flex flex-col items-center gap-1 cursor-pointer"
                                title={gf.name}
                              >
                                <img src={gf.url} alt={gf.name} className="w-full h-16 object-cover rounded pointer-events-none" referrerPolicy="no-referrer" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
  
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

                      {/* Stickers and GIFs panel trigger */}
                      <button
                        onClick={() => setShowStickersAndGifs(!showStickersAndGifs)}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${
                          showStickersAndGifs 
                            ? "bg-indigo-600 border-indigo-600 text-white font-bold" 
                            : "bg-white hover:bg-slate-100 border-[#E2E8F0] text-slate-500 hover:text-slate-800"
                        }`}
                        title="Send stickers or GIFs"
                      >
                        <Smile className="w-4 h-4" />
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
                              {callState.partnerAvatar.length <= 4 ? (
                                <span className="text-4xl">{callState.partnerAvatar}</span>
                              ) : (
                                <img 
                                  src={callState.partnerAvatar} 
                                  alt={callState.partnerName} 
                                  className="w-20 h-20 rounded-full bg-slate-900 border border-slate-700" 
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </div>
                            <div className="text-center">
                              <h4 className="text-base font-bold">{callState.partnerName}</h4>
                              <p className="text-xs text-indigo-400 font-mono mt-1 uppercase tracking-wider">
                                {callState.status === "incoming" 
                                  ? `Incoming ${callState.type === "video" ? "Video" : "Voice"} Call...` 
                                  : callState.status === "ringing" 
                                    ? "Ringing via WebRTC..." 
                                    : "Voice Connected"}
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

                      {/* Controls (Mute, Camera toggle, Hang up / Accept / Decline) */}
                      {callState.status === "incoming" ? (
                        <div className="flex items-center gap-10 mb-4">
                          {/* Green Accept call button */}
                          <button 
                            onClick={acceptCall}
                            className="p-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-lg shadow-emerald-600/30 transform hover:scale-110 flex items-center gap-2 font-bold text-xs uppercase tracking-widest px-6 cursor-pointer"
                          >
                            <Phone className="w-5 h-5 animate-bounce" />
                            Accept
                          </button>

                          {/* Red Decline call button */}
                          <button 
                            onClick={declineCall}
                            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-lg shadow-rose-600/30 transform hover:scale-110 flex items-center gap-2 font-bold text-xs uppercase tracking-widest px-6 cursor-pointer"
                          >
                            <PhoneOff className="w-5 h-5" />
                            Decline
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-6">
                          <button className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer">
                            <MicOff className="w-5 h-5" />
                          </button>
                          
                          {/* Red Hang up button */}
                          <button 
                            id="btn-hangup"
                            onClick={endCall}
                            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-lg shadow-rose-600/30 transform hover:scale-110 cursor-pointer"
                          >
                            <PhoneOff className="w-6 h-6" />
                          </button>

                          <button className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer">
                            <Volume2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                    </motion.div>
                  )}
                </AnimatePresence>

                </div> {/* End of active-chat-pane */}

              </div> {/* End of chat-window container */}

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

              {/* STORIES SLIDESHOW MODAL */}
              <AnimatePresence>
                {activeStoryGroup && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-950/90 z-[999] flex items-center justify-center p-4 backdrop-blur-md"
                    id="story-modal-overlay"
                    onClick={() => setActiveStoryGroup(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      transition={{ type: "spring", damping: 25, stiffness: 350 }}
                      className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col h-[520px]"
                      id="story-modal-content"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Progress bar indicator */}
                      <div className="absolute top-3 left-4 right-4 flex gap-1 z-20">
                        {activeStoryGroup.stories.map((s, index) => {
                          const isPast = index < currentStoryIndex;
                          const isActive = index === currentStoryIndex;
                          return (
                            <div key={s.id} className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isPast 
                                    ? "w-full bg-pink-500" 
                                    : isActive 
                                      ? "w-full bg-pink-500 animate-pulse" 
                                      : "w-0 bg-slate-850"
                                }`} 
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Author Info */}
                      <div className="p-4 pt-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/60 relative z-10">
                        <div className="flex items-center gap-3">
                          <img 
                            src={activeStoryGroup.avatar} 
                            alt={activeStoryGroup.userName} 
                            className="w-10 h-10 rounded-full border border-slate-700 object-contain bg-slate-800"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              {activeStoryGroup.userName}
                              {activeStoryGroup.stories[currentStoryIndex]?.userId === myProfile.id && (
                                <span className="text-[8px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">You</span>
                              )}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-medium">
                              Story {currentStoryIndex + 1} of {activeStoryGroup.stories.length}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Play/Pause control to stop/start the slideshow */}
                          <button
                            onClick={() => {
                              setIsStoryPaused(!isStoryPaused);
                              triggerAlert(isStoryPaused ? "Story slideshow resumed" : "Story slideshow paused", "info");
                            }}
                            className={`p-1.5 rounded-full hover:bg-slate-800 transition-all cursor-pointer ${
                              isStoryPaused ? "text-emerald-400 hover:text-emerald-355" : "text-slate-400 hover:text-white"
                            }`}
                            title={isStoryPaused ? "Resume slideshow" : "Pause / Stop slideshow"}
                          >
                            {isStoryPaused ? <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" /> : <Pause className="w-4 h-4" />}
                          </button>

                          <button 
                            onClick={() => setActiveStoryGroup(null)}
                            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                            id="btn-close-story-modal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Stories Content Slideshow List */}
                      <div className="flex-1 overflow-hidden p-4 flex flex-col justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 relative">
                        
                        {/* Navigation Buttons */}
                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between z-20 pointer-events-none">
                          <button
                            onClick={() => {
                              setCurrentStoryIndex(prev => Math.max(0, prev - 1));
                              setIsStoryPaused(true); // Pause auto-play on manual interaction
                            }}
                            disabled={currentStoryIndex === 0}
                            className={`p-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-white hover:bg-slate-900 transition-all pointer-events-auto cursor-pointer disabled:opacity-0 disabled:cursor-not-allowed`}
                            title="Previous Story"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (currentStoryIndex + 1 < activeStoryGroup.stories.length) {
                                setCurrentStoryIndex(prev => prev + 1);
                                setIsStoryPaused(true); // Pause auto-play on manual interaction
                              } else {
                                setActiveStoryGroup(null);
                              }
                            }}
                            className="p-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-white hover:bg-slate-900 transition-all pointer-events-auto cursor-pointer"
                            title="Next Story"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-col gap-3 text-center items-center h-full justify-center">
                          {(() => {
                            const story = activeStoryGroup.stories[currentStoryIndex];
                            if (!story) return null;
                            return (
                              <div key={story.id} className="w-full flex flex-col items-center gap-3">
                                {/* Story Privacy Indicator */}
                                <div className="flex items-center gap-1.5 justify-between w-full px-2">
                                  <div className="flex items-center gap-1">
                                    {story.type === "close_friends" ? (
                                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Star className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
                                        Close Friends
                                      </span>
                                    ) : story.type === "friends" || (story.type as string) === "private" ? (
                                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Users className="w-2.5 h-2.5" />
                                        Friends Only
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Globe className="w-2.5 h-2.5" />
                                        Public Scope
                                      </span>
                                    )}
                                    <span className="text-[9px] text-slate-500 font-medium font-mono">
                                      • {new Date(story.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  
                                  {/* Delete Button (Visible only to the story author) */}
                                  {story.userId === myProfile.id && (
                                    <button
                                      onClick={() => handleDeleteStory(story.id)}
                                      className="text-[9px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer"
                                      title="Delete your story"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                      Delete
                                    </button>
                                  )}
                                </div>

                                {/* Story Content Text */}
                                <p className="text-sm font-bold text-white leading-relaxed text-center w-full bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 shadow-md">
                                  "{story.content}"
                                </p>

                                {/* Media Attachment in Slideshow */}
                                {story.mediaUrl && (
                                  <div className="w-full rounded-xl overflow-hidden border border-slate-800/85 bg-black/60 mt-1.5 shadow-lg flex items-center justify-center h-48">
                                    {story.mediaType === "video" ? (
                                      <video
                                        src={story.mediaUrl}
                                        className="w-full h-full object-contain mx-auto"
                                        controls
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                      />
                                    ) : (
                                      <img
                                        src={story.mediaUrl}
                                        alt="Story attachment"
                                        className="w-full h-full object-contain mx-auto"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Footer close help */}
                      <div className="p-3 text-center border-t border-slate-800 text-[10px] text-slate-500 font-medium bg-slate-950/40">
                        Click outside to close slideshow
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* UNIFIED FLOATING BOTTOM NAVIGATION BAR (SENSATIONAL DOCK DESIGN) */}
        {/* ======================================================== */}
        {activeTab === "app_demo" && (
          <div className="fixed bottom-0 md:bottom-4 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white/95 backdrop-blur-md border-t md:border border-slate-200/80 shadow-lg md:shadow-2xl px-4 py-2 md:rounded-full z-50 flex items-center justify-around pb-safe transition-all duration-300" id="mobile-instagram-nav">
            {/* 1. Radar / Home Tab */}
            <button
              onClick={() => setMobileDemoTab("radar")}
              className="flex flex-col items-center justify-center py-1 px-3 relative group focus:outline-none cursor-pointer"
              id="mobile-nav-radar"
            >
              <Globe className={`w-5 h-5 transition-all duration-300 ${
                mobileDemoTab === "radar" 
                  ? "text-[#2563EB] scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]" 
                  : "text-slate-400 hover:text-slate-600 hover:scale-105"
              }`} />
              <span className={`text-[9px] font-bold mt-0.5 transition-colors ${
                mobileDemoTab === "radar" ? "text-[#2563EB]" : "text-slate-400"
              }`}>Radar</span>
              {mobileDemoTab === "radar" && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
              )}
            </button>

            {/* 2. Friends Tab with Dynamic Badge */}
            <button
              onClick={() => setMobileDemoTab("friends")}
              className="flex flex-col items-center justify-center py-1 px-3 relative group focus:outline-none cursor-pointer"
              id="mobile-nav-friends"
            >
              <div className="relative">
                <Users className={`w-5 h-5 transition-all duration-300 ${
                  mobileDemoTab === "friends" 
                    ? "text-[#2563EB] scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]" 
                    : "text-slate-400 hover:text-slate-600 hover:scale-105"
                }`} />
                {receivedRequests.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full border-2 border-white animate-pulse min-w-[16px] text-center">
                    {receivedRequests.length}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-bold mt-0.5 transition-colors ${
                mobileDemoTab === "friends" ? "text-[#2563EB]" : "text-slate-400"
              }`}>Friends</span>
              {mobileDemoTab === "friends" && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
              )}
            </button>

            {/* 3. Share / Story Tab */}
            <button
              onClick={() => setMobileDemoTab("share")}
              className="flex flex-col items-center justify-center py-1 px-3 relative group focus:outline-none cursor-pointer"
              id="mobile-nav-share"
            >
              <Camera className={`w-5 h-5 transition-all duration-300 ${
                mobileDemoTab === "share" 
                  ? "text-pink-600 scale-110 drop-shadow-[0_2px_8px_rgba(219,39,119,0.2)]" 
                  : "text-slate-400 hover:text-slate-600 hover:scale-105"
              }`} />
              <span className={`text-[9px] font-bold mt-0.5 transition-colors ${
                mobileDemoTab === "share" ? "text-pink-600" : "text-slate-400"
              }`}>Share</span>
              {mobileDemoTab === "share" && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-pink-600 rounded-full"></span>
              )}
            </button>

            {/* 4. Chat / Messages Tab */}
            <button
              onClick={() => setMobileDemoTab("chat")}
              className="flex flex-col items-center justify-center py-1 px-3 relative group focus:outline-none cursor-pointer"
              id="mobile-nav-chat"
            >
              <MessageCircle className={`w-5 h-5 transition-all duration-300 ${
                mobileDemoTab === "chat" 
                  ? "text-[#2563EB] scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]" 
                  : "text-slate-400 hover:text-slate-600 hover:scale-105"
              }`} />
              <span className={`text-[9px] font-bold mt-0.5 transition-colors ${
                mobileDemoTab === "chat" ? "text-[#2563EB]" : "text-slate-400"
              }`}>Inbox</span>
              {mobileDemoTab === "chat" && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
              )}
            </button>

            {/* 5. Profile Tab (User Profile Photo) */}
            <button
              onClick={() => setMobileDemoTab("profile")}
              className="flex flex-col items-center justify-center py-1 px-3 relative group focus:outline-none cursor-pointer"
              id="mobile-nav-profile"
            >
              <div className={`w-6 h-6 rounded-full border transition-all duration-300 overflow-hidden bg-slate-100 shrink-0 ${
                mobileDemoTab === "profile" 
                  ? "ring-2 ring-[#2563EB] ring-offset-1 border-transparent scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]" 
                  : "border-slate-300 hover:scale-105"
              }`}>
                <img src={avatarUrl} alt="Me" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span className={`text-[9px] font-bold mt-0.5 transition-colors ${
                mobileDemoTab === "profile" ? "text-[#2563EB]" : "text-slate-400"
              }`}>Profile</span>
              {mobileDemoTab === "profile" && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
              )}
            </button>
          </div>
        )}

      </main>

      {/* Footer Info credit lines */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 hidden md:flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
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
