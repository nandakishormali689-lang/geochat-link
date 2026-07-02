import React, { useState } from "react";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Compass, Lock, Mail, User, Sparkles, Trophy, Code, Camera, Music, BookOpen, 
  ChevronRight, Eye, EyeOff, AlertCircle, CheckCircle, Info 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

function handleLocalFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
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

interface AuthScreenProps {
  auth: any;
  db: any;
  onAuthSuccess: (user: any) => void;
  triggerAlert: (text: string, type: "success" | "info" | "error") => void;
}

const INTERESTS_LIST = [
  { id: "coding", name: "Coding", icon: Code, color: "bg-blue-500/10 text-blue-400 border border-blue-500/25" },
  { id: "cricket", name: "Cricket", icon: Trophy, color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" },
  { id: "photography", name: "Photography", icon: Camera, color: "bg-purple-500/10 text-purple-400 border border-purple-500/25" },
  { id: "music", name: "Music", icon: Music, color: "bg-rose-500/10 text-rose-400 border border-rose-500/25" },
  { id: "study", name: "Study", icon: BookOpen, color: "bg-amber-500/10 text-amber-400 border border-amber-500/25" }
];

export function AuthScreen({ auth, db, onAuthSuccess, triggerAlert }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Custom Profile states for Sign Up
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("Excited to meet cool people nearby! Let's grab coffee and chat.");
  const [avatarSeed, setAvatarSeed] = useState(() => "user_" + Math.floor(1000 + Math.random() * 9000));
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["coding", "music"]);
  
  // Location States
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [locatedArea, setLocatedArea] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "detecting" | "success" | "failed">("idle");
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rollAvatarSeed = () => {
    const prefixes = ["leo", "sparky", "felix", "scooter", "buster", "shadow", "ginger", "patch", "milo", "lola"];
    const newSeed = prefixes[Math.floor(Math.random() * prefixes.length)] + "_" + Math.floor(100 + Math.random() * 900);
    setAvatarSeed(newSeed);
  };

  const handleInterestToggle = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId)
        ? prev.filter(i => i !== interestId)
        : [...prev, interestId]
    );
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("failed");
      triggerAlert("Geolocation is not supported by your browser.", "error");
      return;
    }
    
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        setLatitude(lat);
        setLongitude(lon);
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14`);
          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};
            const suburb = address.suburb || address.neighbourhood || address.residential || address.village || "";
            const city = address.city || address.town || address.state || "";
            const areaName = [suburb, city].filter(Boolean).join(", ") || data.display_name || "Approximate Location";
            setLocatedArea(areaName);
          } else {
            setLocatedArea(`Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`);
          }
          setLocationStatus("success");
          triggerAlert("Successfully detected physical coordinates!", "success");
        } catch (err) {
          console.warn("Reverse geocode failed, using coordinates", err);
          setLocatedArea(`Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`);
          setLocationStatus("success");
        }
      },
      (error) => {
        console.warn("Location error:", error);
        setLocationStatus("failed");
        triggerAlert("Could not obtain GPS coordinates. Using standard default coordinates.", "info");
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please fill out all email and password fields.");
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setErrorMessage("Please enter your display name.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        // Sign up with Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        const user = credential.user;

        // Generate final profile data
        const profilePayload = {
          id: user.uid,
          name: fullName.trim(),
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`,
          avatarSeed,
          interests: selectedInterests,
          bio: bio.trim() || "Active Geochat Link member",
          online: true,
          latitude,
          longitude,
          lastActive: serverTimestamp()
        };

        // Save profile payload to Firestore users collection
        try {
          await setDoc(doc(db, "users", user.uid), profilePayload);
        } catch (dbErr) {
          handleLocalFirestoreError(dbErr, OperationType.WRITE, `users/${user.uid}`, auth);
        }
        
        triggerAlert("Account created successfully! Welcome to Geochat Link.", "success");
        onAuthSuccess(user);
      } else {
        // Sign in with Firebase Auth
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        const user = credential.user;

        // Mark user as online in Firestore
        try {
          await setDoc(doc(db, "users", user.uid), {
            online: true,
            lastActive: serverTimestamp()
          }, { merge: true });
        } catch (dbErr) {
          handleLocalFirestoreError(dbErr, OperationType.WRITE, `users/${user.uid}`, auth);
        }

        triggerAlert("Logged in successfully! Welcome back.", "success");
        onAuthSuccess(user);
      }
    } catch (err: any) {
      console.error("Firebase auth action failed:", err);
      let errMsg = err.message || "An authentication error occurred.";
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errMsg = "Invalid email or password combination.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email address is already registered.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password must be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/operation-not-allowed") {
        errMsg = "Email/Password registration and login are currently disabled in your Firebase project. To enable them, go to your Firebase Console (Authentication > Sign-in method) and turn on the Email/Password provider. Alternatively, you can log in instantly with Google Sign-In below.";
      }
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;
      triggerAlert("Logged in successfully via Google!", "success");
      onAuthSuccess(user);
    } catch (err: any) {
      console.error("Google sign-in failed:", err);
      let errMsg = err.message || "An authentication error occurred during Google Sign-In.";
      if (err.code === "auth/popup-closed-by-user") {
        errMsg = "Google login popup was closed before completing.";
      } else if (err.code === "auth/cancelled-popup-request") {
        errMsg = "Google sign-in popup request was cancelled.";
      }
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Absolute Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 filter blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="p-6 sm:p-8 flex flex-col gap-6">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Geochat Link</h2>
              <p className="text-xs text-slate-400 mt-1">Real-Time Geolocation Chat Workspace</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.form 
              key={isSignUp ? "signup" : "signin"}
              initial={{ opacity: 0, x: isSignUp ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? -30 : 30 }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-11 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <>
                  {/* Display Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Handle Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Profile Bio */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profile Bio</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Write a brief bio about your interests..."
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600 resize-none"
                    />
                  </div>

                  {/* Dynamic Avatar Setup */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center relative overflow-hidden group shrink-0">
                      <img 
                        src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`} 
                        alt="Dicebear vector" 
                        className="w-14 h-14 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        type="button"
                        onClick={rollAvatarSeed}
                        className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Roll
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Vector Seed</span>
                      <input 
                        type="text" 
                        value={avatarSeed}
                        onChange={(e) => setAvatarSeed(e.target.value || "user")}
                        placeholder="Custom seed"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[8px] text-slate-500 font-semibold uppercase">Powered by DiceBear API</span>
                    </div>
                  </div>

                  {/* Interests Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select My Match Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {INTERESTS_LIST.map((tag) => {
                        const isSelected = selectedInterests.includes(tag.id);
                        const Icon = tag.icon;
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleInterestToggle(tag.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                              isSelected 
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                                : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Geolocation Detection */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Physical GPS Coordinates</span>
                      {locationStatus === "success" && (
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ready
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal font-medium">
                      Geochat Link uses real-world physical coordinates to link you with users in your general area while keeping exact coordinates completely anonymous.
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={locationStatus === "detecting"}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold uppercase tracking-wider text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Compass className={`w-4 h-4 ${locationStatus === "detecting" ? "animate-spin text-emerald-400" : "text-slate-400"}`} />
                        {locationStatus === "detecting" ? "Detecting..." : "Detect Location"}
                      </button>
                      <div className="flex-1 min-w-0">
                        {locatedArea ? (
                          <div className="text-xs">
                            <span className="font-bold text-slate-200 block truncate">{locatedArea}</span>
                            <span className="text-[9px] text-slate-500 font-mono font-bold block">{latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-600 block italic">GPS coordinates pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : (
                  <>
                    <span>{isSignUp ? "Register & Enter Workspace" : "Authenticate & Open Workspace"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-70"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.53 14.98 1 12 1 7.35 1 3.37 3.68 1.43 7.6l3.87 3C6.22 7.74 8.89 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.45 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.43c-.28 1.45-1.1 2.67-2.33 3.5l3.62 2.8c2.12-1.95 3.35-4.83 3.35-8.43z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.4c-.24-.71-.38-1.47-.38-2.4s.14-1.69.38-2.4l-3.87-3C.53 8.13 0 9.99 0 12s.53 3.87 1.43 5.4l3.87-3z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.62-2.8c-1 .67-2.28 1.07-3.95 1.07-3.11 0-5.78-2.7-6.7-5.56l-3.87 3C3.37 20.32 7.35 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Form Switch Button */}
          <div className="border-t border-slate-800/80 pt-5 text-center flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage(null);
              }}
              className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors uppercase tracking-wider"
            >
              {isSignUp ? "Already registered? Sign In" : "New member? Create an Account"}
            </button>
            <p className="text-[10px] text-slate-600 max-w-xs font-medium mt-1 leading-normal">
              By connecting, you consent to real-time sync via Google Cloud Firestore.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
