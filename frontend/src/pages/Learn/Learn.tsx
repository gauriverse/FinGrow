import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock3, CheckCircle2 } from "lucide-react";
import {
  getLearningContent,
  getLearningProgress,
} from "../../services/learnService";

import { useNavigate } from "react-router-dom";

type LearningContent = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimated_minutes: number;
  display_order: number;
};

type LearningProgress = {
  id: string;
  content_id: string;
  progress_percent: number;
  completed: boolean;
  completed_at: string | null;
};

export default function Learn() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<LearningContent[]>([]);
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLearnData() {
      try {
        setLoading(true);
        setError("");

        const [contentData, progressData] = await Promise.all([
          getLearningContent(),
          getLearningProgress(),
        ]);

        setLessons(contentData.content || []);
        setProgress(progressData.progress || []);
      } catch (err) {
        console.error("Learn loading error:", err);
        setError("Unable to load learning content.");
      } finally {
        setLoading(false);
      }
    }

    loadLearnData();
  }, []);

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(lessons.map((lesson) => lesson.category))
      ),
    ];
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    if (selectedCategory === "All") {
      return lessons;
    }

    return lessons.filter(
      (lesson) => lesson.category === selectedCategory
    );
  }, [lessons, selectedCategory]);

  const completedCount = progress.filter(
    (item) => item.completed
  ).length;

  const overallProgress =
    lessons.length > 0
      ? Math.round((completedCount / lessons.length) * 100)
      : 0;

  const getLessonProgress = (lessonId: string) => {
    return progress.find(
      (item) => item.content_id === lessonId
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading Learn...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      {/* HEADER */}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <BookOpen
                size={22}
                className="text-emerald-700"
              />
            </div>

            <h1 className="text-3xl font-semibold">
              Learn
            </h1>
          </div>

          <p className="text-gray-500">
            Build your understanding of investing,
            markets and financial analysis step by step.
          </p>
        </div>


        {/* PROGRESS CARD */}

        <div className="bg-white border rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">
                Your Learning Progress
              </p>

              <h2 className="text-2xl font-semibold mt-1">
                {completedCount} / {lessons.length} lessons
              </h2>
            </div>

            <div className="text-right">
              <p className="text-2xl font-semibold text-emerald-700">
                {overallProgress}%
              </p>

              <p className="text-xs text-gray-500">
                completed
              </p>
            </div>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all"
              style={{
                width: `${overallProgress}%`,
              }}
            />
          </div>
        </div>


        {/* CATEGORY FILTERS */}

        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() =>
                setSelectedCategory(category)
              }
              className={`px-4 py-2 rounded-full text-sm border transition ${
                selectedCategory === category
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>


        {/* LESSONS */}

        {categories
          .filter(
            (category) =>
              selectedCategory === "All" ||
              category === selectedCategory
          )
          .map((category) => {
            const categoryLessons =
              filteredLessons.filter(
                (lesson) =>
                  lesson.category === category
              );

            if (categoryLessons.length === 0) {
              return null;
            }

            return (
              <section
                key={category}
                className="mb-10"
              >
                <h2 className="text-xl font-semibold mb-4">
                  {category}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {categoryLessons.map((lesson) => {
                    const lessonProgress =
                      getLessonProgress(lesson.id);

                    const completed =
                      lessonProgress?.completed === true;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() =>
                          navigate(
                            `/learn/${lesson.slug}`
                          )
                        }
                        className="text-left bg-white border rounded-2xl p-5 hover:shadow-md transition group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-lg group-hover:text-emerald-700 transition">
                              {lesson.title}
                            </h3>

                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                              {lesson.description}
                            </p>
                          </div>

                          {completed && (
                            <CheckCircle2
                              size={20}
                              className="text-emerald-600 shrink-0"
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-5 text-xs text-gray-500">
                          <span>
                            {lesson.difficulty}
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock3 size={14} />
                            {lesson.estimated_minutes} min
                          </span>
                        </div>

                        {lessonProgress &&
                          !completed && (
                            <div className="mt-4">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>
                                  Progress
                                </span>

                                <span>
                                  {
                                    lessonProgress.progress_percent
                                  }
                                  %
                                </span>
                              </div>

                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600"
                                  style={{
                                    width: `${lessonProgress.progress_percent}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}