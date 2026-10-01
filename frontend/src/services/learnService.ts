import { supabase } from "../lib/supabase";

const API_BASE_URL = "http://127.0.0.1:8000";

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("User is not authenticated");
  }

  return session.access_token;
}


// ============================================================
// GET LEARNING CONTENT
// ============================================================

export async function getLearningContent() {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/learn/content`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load learning content");
  }

  return response.json();
}


// ============================================================
// GET SINGLE LESSON
// ============================================================

export async function getLearningLesson(slug: string) {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/learn/content/${slug}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load lesson");
  }

  return response.json();
}


// ============================================================
// GET USER PROGRESS
// ============================================================

export async function getLearningProgress() {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/learn/progress`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load learning progress");
  }

  return response.json();
}


// ============================================================
// UPDATE USER PROGRESS
// ============================================================

export async function updateLearningProgress(
  contentId: string,
  progressPercent: number
) {
  const token = await getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/learn/progress/${contentId}?progress_percent=${progressPercent}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update learning progress");
  }

  return response.json();
}