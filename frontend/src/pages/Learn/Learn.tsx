import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getLearningContent,
  getLearningProgress,
} from "../../services/learnService";

type Lesson = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  display_order: number;
};

type Progress = {
  content_id: string;
  progress_percent: number;
  completed: boolean;
};

export default function Learn() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search + filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

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

  // ---------------------------------------------------------
  // PROGRESS MAP
  // ---------------------------------------------------------

  const progressMap = useMemo(() => {
    const map: Record<string, Progress> = {};

    progress.forEach((item) => {
      map[item.content_id] = item;
    });

    return map;
  }, [progress]);

  // ---------------------------------------------------------
  // OVERALL PROGRESS
  // ---------------------------------------------------------

  const overallProgress = useMemo(() => {
    if (!lessons.length) return 0;

    const total = lessons.reduce((sum, lesson) => {
      return sum + (progressMap[lesson.id]?.progress_percent || 0);
    }, 0);

    return Math.round(total / lessons.length);
  }, [lessons, progressMap]);

  const completedCount = useMemo(() => {
    return lessons.filter(
      (lesson) => progressMap[lesson.id]?.completed
    ).length;
  }, [lessons, progressMap]);

  // ---------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------

  const categories = useMemo(() => {
    return [...new Set(lessons.map((lesson) => lesson.category))];
  }, [lessons]);

  const categoryIds: Record<string, string> = {
    "Stock Market Basics": "stock-market-basics",
    "Fundamental Analysis": "fundamental-analysis",
    "Technical Analysis": "technical-analysis",
    "Risk Management": "risk-management",
  };

  // ---------------------------------------------------------
  // FILTERED LESSONS
  // ---------------------------------------------------------

  const filteredLessons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return lessons
      .filter((lesson) => {
        const matchesCategory =
          selectedCategory === "All" ||
          lesson.category === selectedCategory;

        const matchesSearch =
          !query ||
          lesson.title.toLowerCase().includes(query) ||
          lesson.description.toLowerCase().includes(query) ||
          lesson.category.toLowerCase().includes(query) ||
          lesson.difficulty.toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
      })
      .sort(
        (a, b) => a.display_order - b.display_order
      );
  }, [lessons, searchQuery, selectedCategory]);

  // ---------------------------------------------------------
  // FILTERED CATEGORIES
  // ---------------------------------------------------------

  const filteredCategories = useMemo(() => {
    return [
      ...new Set(
        filteredLessons.map((lesson) => lesson.category)
      ),
    ];
  }, [filteredLessons]);

  const isFiltering =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "All";

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <p className="text-gray-500">
          Loading Learn...
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------

  if (error) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <p className="text-red-500">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-8">

          <div className="flex items-center gap-3 mb-3">

            <div className="w-10 h-10 rounded-xl bg-[#0F4C3A]/10 flex items-center justify-center">

              <BookOpen
                className="text-[#0F4C3A]"
                size={22}
              />

            </div>

            <h1 className="text-3xl font-bold text-gray-900">
              Learn
            </h1>

          </div>

          <p className="text-gray-500 max-w-2xl">
            Build your investing knowledge step by step —
            from stock-market basics to analysis and risk
            management.
          </p>

        </div>

        {/* ================================================= */}
        {/* SEARCH + FILTERS */}
        {/* ================================================= */}

        <div className="mb-8">

          {/* Search */}

          <div className="relative max-w-xl">

            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              placeholder="Search lessons..."
              className="w-full h-11 pl-11 pr-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0F4C3A]/40 focus:ring-2 focus:ring-[#0F4C3A]/5 transition"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            )}

          </div>

          {/* Category Filters */}

          <div className="flex items-center gap-2 flex-wrap mt-4">

            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedCategory === "All"
                  ? "bg-[#0F4C3A] text-white"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  setSelectedCategory(category)
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedCategory === category
                    ? "bg-[#0F4C3A] text-white"
                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {category}
              </button>
            ))}

          </div>

        </div>

        {/* ================================================= */}
        {/* OVERALL PROGRESS */}
        {/* ================================================= */}

        {!isFiltering && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 mb-8">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

              <div>

                <p className="text-sm text-gray-500 mb-1">
                  Overall Progress
                </p>

                <h2 className="text-2xl font-semibold text-gray-900">
                  {overallProgress}%
                </h2>

              </div>

              <div className="text-sm text-gray-500">
                {completedCount} of {lessons.length} lessons
                completed
              </div>

            </div>

            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">

              <div
                className="h-full bg-[#0F4C3A] rounded-full transition-all duration-500"
                style={{
                  width: `${overallProgress}%`,
                }}
              />

            </div>

          </div>
        )}

        {/* ================================================= */}
        {/* SEARCH RESULT COUNT */}
        {/* ================================================= */}

        {isFiltering && (
          <div className="flex items-center justify-between mb-6">

            <p className="text-sm text-gray-500">

              {filteredLessons.length === 0
                ? "No lessons found"
                : `${filteredLessons.length} ${
                    filteredLessons.length === 1
                      ? "lesson"
                      : "lessons"
                  } found`}

            </p>

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="text-sm text-[#0F4C3A] hover:underline"
            >
              Clear filters
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* CATEGORY QUICK NAVIGATION */}
        {/* ================================================= */}

        {!isFiltering && (
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm py-4 mb-8 border-b border-gray-100">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

              {categories.map((category) => {

                const categoryLessons =
                  lessons.filter(
                    (lesson) =>
                      lesson.category === category
                  );

                const categoryCompleted =
                  categoryLessons.filter(
                    (lesson) =>
                      progressMap[lesson.id]?.completed
                  ).length;

                return (
                  <button
                    key={category}
                    onClick={() => {
                      document
                        .getElementById(
                          categoryIds[category]
                        )
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    className="text-left rounded-xl border border-gray-200 bg-white hover:border-[#0F4C3A]/30 hover:shadow-sm transition p-4"
                  >

                    <div className="flex items-center justify-between gap-2">

                      <p className="text-sm font-semibold text-gray-900">
                        {category}
                      </p>

                      {categoryCompleted ===
                        categoryLessons.length && (
                        <CheckCircle2
                          size={17}
                          className="text-[#0F4C3A]"
                        />
                      )}

                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      {categoryCompleted} /{" "}
                      {categoryLessons.length} completed
                    </p>

                  </button>
                );
              })}

            </div>

          </div>
        )}

        {/* ================================================= */}
        {/* NO RESULTS */}
        {/* ================================================= */}

        {filteredLessons.length === 0 && (
          <div className="py-16 text-center">

            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">

              <Search
                size={20}
                className="text-gray-400"
              />

            </div>

            <h3 className="font-semibold text-gray-900 mb-1">
              No lessons found
            </h3>

            <p className="text-sm text-gray-500 mb-4">
              Try a different search term or category.
            </p>

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="text-sm font-medium text-[#0F4C3A] hover:underline"
            >
              Clear filters
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* LESSON CATEGORIES */}
        {/* ================================================= */}

        {filteredLessons.length > 0 && (
          <div className="space-y-14">

            {filteredCategories.map((category) => {

              const categoryLessons = filteredLessons
                .filter(
                  (lesson) =>
                    lesson.category === category
                )
                .sort(
                  (a, b) =>
                    a.display_order - b.display_order
                );

              const categoryCompleted =
                categoryLessons.filter(
                  (lesson) =>
                    progressMap[lesson.id]?.completed
                ).length;

              return (
                <section
                  key={category}
                  id={
                    !isFiltering
                      ? categoryIds[category]
                      : undefined
                  }
                  className="scroll-mt-28"
                >

                  {/* Category Header */}

                  <div className="flex items-end justify-between mb-5">

                    <div>

                      <h2 className="text-xl font-semibold text-gray-900">
                        {category}
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        {categoryCompleted} of{" "}
                        {categoryLessons.length} completed
                      </p>

                    </div>

                  </div>

                  {/* Lesson Cards */}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                    {categoryLessons.map((lesson) => {

                      const lessonProgress =
                        progressMap[lesson.id];

                      const isCompleted =
                        lessonProgress?.completed === true;

                      const percent =
                        lessonProgress?.progress_percent ||
                        0;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            navigate(
                              `/learn/${lesson.slug}`
                            )
                          }
                          className="text-left rounded-2xl border border-gray-200 bg-white hover:border-[#0F4C3A]/30 hover:shadow-md transition p-5 group"
                        >

                          {/* Card Top */}

                          <div className="flex items-start justify-between gap-4 mb-4">

                            <div className="w-10 h-10 rounded-xl bg-[#0F4C3A]/10 flex items-center justify-center">

                              {isCompleted ? (
                                <CheckCircle2
                                  size={20}
                                  className="text-[#0F4C3A]"
                                />
                              ) : (
                                <BookOpen
                                  size={20}
                                  className="text-[#0F4C3A]"
                                />
                              )}

                            </div>

                            {isCompleted && (
                              <span className="text-xs font-medium text-[#0F4C3A]">
                                Completed
                              </span>
                            )}

                          </div>

                          {/* Title */}

                          <h3 className="font-semibold text-lg text-gray-900 mb-2 group-hover:text-[#0F4C3A] transition">
                            {lesson.title}
                          </h3>

                          {/* Description */}

                          <p className="text-sm text-gray-500 leading-6 mb-5">
                            {lesson.description}
                          </p>

                          {/* Metadata */}

                          <div className="flex items-center gap-4 text-xs text-gray-400">

                            <span>
                              {lesson.difficulty}
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock3 size={13} />
                              {lesson.estimated_minutes} min
                            </span>

                          </div>

                          {/* Progress */}

                          <div className="mt-5">

                            <div className="flex justify-between text-xs mb-2">

                              <span className="text-gray-400">
                                Progress
                              </span>

                              <span className="text-gray-500">
                                {percent}%
                              </span>

                            </div>

                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">

                              <div
                                className="h-full bg-[#0F4C3A] rounded-full transition-all"
                                style={{
                                  width: `${percent}%`,
                                }}
                              />

                            </div>

                          </div>

                        </button>
                      );
                    })}

                  </div>

                </section>
              );
            })}

          </div>
        )}

      </div>
    </div>
  );
}