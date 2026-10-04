import { supabase } from "../lib/supabase";

const API_BASE_URL = "http://127.0.0.1:8000";

type LearningContent = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  display_order: number;
};

type LearningContentResponse = {
  content: LearningContent[];
};

type LearningProgress = {
  id?: string;
  content_id: string;
  progress_percent: number;
  completed: boolean;
  completed_at?: string | null;
};

type LearningProgressResponse = {
  progress: LearningProgress[];
};

type LessonContentBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "formula";
      text: string;
    }
  | {
      type: "key_points";
      items: string[];
    };

type LearningLesson = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  content: LessonContentBlock[];
  difficulty: string;
  estimated_minutes: number;
};

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("User is not authenticated");
  }

  return session.access_token;
};

// ============================================================
// CACHE
// ============================================================

let contentCache: LearningContentResponse | null = null;
let progressCache: LearningProgressResponse | null = null;

let contentPromise: Promise<LearningContentResponse> | null = null;
let progressPromise: Promise<LearningProgressResponse> | null = null;

// ============================================================
// GET LEARNING CONTENT
// ============================================================

export async function getLearningContent(): Promise<LearningContentResponse> {
  if (contentCache) {
    return contentCache;
  }

  if (contentPromise) {
    return contentPromise;
  }

  contentPromise = (async () => {
    try {
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

      const data =
        (await response.json()) as LearningContentResponse;

      contentCache = data;

      return data;
    } finally {
      contentPromise = null;
    }
  })();

  return contentPromise;
}

// ============================================================
// GET SINGLE LESSON
// ============================================================

export async function getLearningLesson(
  slug: string
): Promise<LearningLesson> {
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

  return (await response.json()) as LearningLesson;
}

// ============================================================
// GET USER PROGRESS
// ============================================================

export async function getLearningProgress(): Promise<LearningProgressResponse> {
  if (progressCache) {
    return progressCache;
  }

  if (progressPromise) {
    return progressPromise;
  }

  progressPromise = (async () => {
    try {
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

      const data =
        (await response.json()) as LearningProgressResponse;

      progressCache = data;

      return data;
    } finally {
      progressPromise = null;
    }
  })();

  return progressPromise;
}

// ============================================================
// UPDATE USER PROGRESS
// ============================================================

export async function updateLearningProgress(
  contentId: string,
  progressPercent: number
): Promise<LearningProgress> {
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

  const data =
    (await response.json()) as LearningProgress;

  // Refresh progress on the next request
  progressCache = null;

  return data;
}