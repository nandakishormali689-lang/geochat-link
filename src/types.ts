export interface StackFeature {
  feature: string;
  freeService: string;
  purpose: string;
  icon: string;
  category: "Core" | "Calls" | "Social" | "AI" | "Fun" | "Security";
  implementationGuide: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  type: "text" | "image" | "file" | "audio";
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  translation?: string;
  originalText?: string;
  reactions?: { [emoji: string]: number };
  isEdited?: boolean;
}

export interface NearbyUser {
  id: string;
  name: string;
  avatar: string;
  distance: number; // in km
  interests: string[];
  bio: string;
  status: "none" | "sent" | "received" | "accepted";
  online: boolean;
  typing?: boolean;
}

export interface LocalCommunity {
  id: string;
  name: string;
  category: string;
  membersCount: number;
  description: string;
  distance: number; // in km
  icon: string;
}

export interface CallState {
  type: "none" | "voice" | "video";
  status: "idle" | "ringing" | "connected";
  partnerId?: string;
  partnerName?: string;
  partnerAvatar?: string;
  duration?: number;
}
