import Constants from "expo-constants";

// Helper to determine the backend API base URL
const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Expo host Uri fallback if running on physical device/emulator
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:6700`;
  }
  return "http://localhost:6700";
};

export const API_BASE_URL = getApiBaseUrl();

// --- Auth Types & APIs ---

export type LoginPayload = {
  identifier: string; // email or phone number
  password: string;
};

export type SendOtpPayload = {
  identifier: string;
  type: "email" | "sms";
  purpose: "registration";
  provider: "email" | "sms";
};

export type VerifyOtpPayload = {
  identifier: string;
  code: string;
  purpose: "registration";
};

export type RegisterPayload = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  role: string;
  phone_number: string;
  email?: string;
  password: string;
  address?: string;
  facility_id?: string;
  otp: string;
};

export type SetupPasswordPayload = {
  identifier: string;
  otp: string;
  newPassword: string;
};

export type AuthUser = {
  user_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  role: string;
  email?: string;
  phone_number?: string;
  address?: string;
  facility_id?: string | null;
  facility_name?: string;
};

export type MotherRecord = {
  mother_id: string;
  user_id: string;
  family_serial_no?: string;
  birth_date?: string;
  age?: number;
  civil_status?: string;
  blood_type?: string;
  pregnancies?: PregnancyRecord[];
};

export type PregnancyRecord = {
  pregnancy_id: string;
  mother_id: string;
  date_of_registration: string;
  lmp_date: string;
  gravida: number;
  parity: number;
  pregnancy_status: string;
  prenatalVisits?: PrenatalVisitRecord[];
  deliveryOutcomes?: DeliveryOutcomeRecord[];
};

export type NewbornRecord = {
  newborn_id: string;
  delivery_id: string;
  sex: string;
  birth_weight_kg: number | string;
  status_at_birth: string;
  apgar_score: number;
  created_at?: string;
};

export type DeliveryOutcomeRecord = {
  delivery_id: string;
  pregnancy_id: string;
  delivery_date: string;
  place_of_delivery: string;
  mode_of_delivery: string;
  duration_of_labor_hours?: number | string;
  blood_loss_ml?: number;
  delivery_complications?: string;
  newbornRecords?: NewbornRecord[];
};

export type PrenatalVisitRecord = {
  visit_id: string;
  pregnancy_id: string;
  visit_date: string;
  trimester: number;
  visit_number: number;
  age_of_gestation_weeks: number;
  weight_kg: number | string;
  temperature_celsius: number | string;
  pulse_rate_bpm: number;
  bp_diastolic: number;
  bp_systolic: number;
  fundic_height_cm?: number | string;
  fetal_heart_tone_bpm?: number;
  chief_complaint?: string;
  risk_level_assessed?: string;
};

export type AppointmentRecord = {
  appointment_id: string;
  user_id: string;
  facility_id?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  reason?: string;
  status: string;
};

export type SupplementRecord = {
  supplement_id: string;
  pregnancy_id: string;
  visit_id: string;
  supplement_type: string;
  tablets_given_count: number;
  date_given: string;
  is_completed: boolean;
};

export type LabScreeningRecord = {
  screening_id: string;
  pregnancy_id: string;
  visit_id: string;
  screening_type: string;
  result: string;
  file_url?: string;
  date_of_screening: string;
  remarks?: string;
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const err: any = new Error(data.error || data.message || "Failed to log in");
    err.requiresPasswordSetup = data.requiresPasswordSetup;
    err.identifier = data.identifier;
    throw err;
  }

  if (data.user && data.user.role && data.user.role.trim().toLowerCase() !== "mother") {
    throw new Error(`Account found, but it is registered as '${data.user.role}'. The mobile app is restricted to Mother accounts.`);
  }

  return data;
}

export async function sendOtpApi(payload: SendOtpPayload): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/send/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to send OTP code");
  }

  return data;
}

export async function verifyOtpApi(payload: VerifyOtpPayload): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/send/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Invalid OTP code");
  }

  return data;
}

export async function registerApi(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Registration failed");
  }

  return data;
}

export async function setupPasswordApi(payload: SetupPasswordPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/setup-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Password setup failed");
  }

  if (data.user && data.user.role && data.user.role.toLowerCase() !== "mother") {
    throw new Error("No account found.");
  }

  return data;
}

// --- Mother Profile APIs ---

export async function getMotherProfileApi(token: string): Promise<{ result: { mother_id?: string; user?: AuthUser; pregnancies?: PregnancyRecord[] } }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mother/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch mother profile");
  }

  return data;
}

export async function updateMotherProfileApi(payload: any, token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mother/profile/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to update profile");
  }

  return data;
}

// --- Appointment APIs ---

export async function getAppointmentsByUserApi(userId: string, token: string): Promise<AppointmentRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/appointment/get/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    return [];
  }

  const list = data.result || data.data || data;
  return Array.isArray(list) ? list : [];
}

export async function createAppointmentApi(payload: any, token: string): Promise<AppointmentRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/appointment/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to create appointment");
  }

  return data.result || data.data || data;
}

export async function cancelAppointmentApi(appointmentId: string, token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/appointment/cancel/${appointmentId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to cancel appointment");
  }

  return data;
}

// --- Supplement APIs ---

export async function getSupplementsByMotherApi(motherId: string, token: string): Promise<SupplementRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/supplement/get/mother/${motherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    return [];
  }

  const list = data.result || data.data || data;
  return Array.isArray(list) ? list : [];
}

export async function updateSupplementStatusApi(payload: { supplement_id: string; is_completed: boolean }, token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/supplement/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to update supplement");
  }

  return data;
}

// --- Lab Screening APIs ---

export async function getLabScreeningsByMotherApi(motherId: string, token: string): Promise<LabScreeningRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lab-screening/get/mother/${motherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    return [];
  }

  const list = data.result || data.data || data;
  return Array.isArray(list) ? list : [];
}

export async function uploadLabFileApi(formData: FormData, token: string): Promise<{ fileUrl: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lab-screening/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to upload file");
  }

  return data;
}

export async function createLabScreeningApi(payload: any, token: string): Promise<LabScreeningRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lab-screening/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to register lab record");
  }

  return data.result || data;
}

export async function changePasswordApi(payload: { currentPassword: string; newPassword: string }, token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to change password");
  }

  return data;
}

export async function deleteAccountApi(motherId: string, token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mother/soft-delete/${motherId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to delete account");
  }

  return data;
}

export type InAppMessage = {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  message_type: string;
  message_content: string;
  message_date: string;
  is_read: boolean;
};

export type ChatContact = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  profile_url?: string;
};

export async function getMessagesApi(token: string): Promise<{ data: InAppMessage[]; contact?: ChatContact }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/message/getAll`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    return { data: [] };
  }

  return {
    data: Array.isArray(data.data) ? data.data : [],
    contact: data.contact,
  };
}

export async function sendMessageApi(
  payload: { receiver_id?: string; message_content: string; message_type?: string },
  token: string
): Promise<InAppMessage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/message/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      message_date: new Date().toISOString(),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to send message");
  }

  return data.data || data;
}
