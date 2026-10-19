import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getLearningContent,
  getLearningProgress,
} from "../../services/learnService";
import Sidebar from "../../components/Sidebar";
import HeaderActions from "../../components/HeaderActions";

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

// Shared presentation classes (UI only)
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40";

export default function Learn() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  // LOADING (skeleton)
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div
        className="min-h-screen bg-white text-gray-900"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading Learn...</span>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 animate-pulse motion-reduce:animate-none">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-gray-100" />
            <div className="space-y-2">
              <div className="h-5 w-24 rounded bg-gray-100" />
              <div className="h-3 w-64 max-w-full rounded bg-gray-100" />
            </div>
          </div>

          <div className="h-10 rounded-lg bg-gray-100 mb-4" />
          <div className="h-16 rounded-xl bg-gray-100 mb-5" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-xl border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------

  if (error) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6">
        <p className="text-red-500" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
 <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
   <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 ${FOCUS_RING}`}
            aria-label="Open menu"
            title="Menu"
          >
            <Menu size={20} />
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C3A]/40"
          >
            <ArrowLeft
              size={16}
              className="transition-transform motion-safe:group-hover:-translate-x-0.5"
            />
            <span>Dashboard</span>
          </button>
        </div>

        <HeaderActions />
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">


        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="flex items-center gap-3 mb-4">

          <div className="w-9 h-9 shrink-0 rounded-lg bg-[#0F4C3A]/10 flex items-center justify-center">

            <BookOpen
              className="text-[#0F4C3A]"
              size={20}
            />

          </div>

          <div className="min-w-0">

            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Learn
            </h1>

            <p className="text-gray-500 text-sm sm:text-base">
              Build your investing knowledge step by step —
              from stock-market basics to analysis and risk
              management.
            </p>

          </div>

        </div>

        {/* ================================================= */}
        {/* SEARCH + FILTERS */}
        {/* ================================================= */}

        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 mb-4">

          {/* Search */}

          <div className="relative w-full lg:w-72 lg:shrink-0">

            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              placeholder="Search lessons..."
              aria-label="Search lessons"
              className="w-full h-9 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0F4C3A]/40 focus:ring-2 focus:ring-[#0F4C3A]/10 transition-colors"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                title="Clear search"
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 transition-colors ${FOCUS_RING}`}
              >
                <X size={15} />
              </button>
            )}

          </div>

          {/* Category Filters (scroll horizontally on small screens) */}

          <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <button
              onClick={() => setSelectedCategory("All")}
              aria-pressed={selectedCategory === "All"}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 motion-safe:active:scale-[0.97] ${FOCUS_RING} ${
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
                aria-pressed={selectedCategory === category}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 motion-safe:active:scale-[0.97] ${FOCUS_RING} ${
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
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">

            <div className="flex items-center justify-between gap-3 mb-2">

              <div className="flex items-baseline gap-2">

                <h2 className="text-2xl font-semibold text-gray-900 tabular-nums">
                  {overallProgress}%
                </h2>

                <p className="text-sm text-gray-500">
                  Overall Progress
                </p>

              </div>

              <div className="text-sm text-gray-500 tabular-nums text-right">
                {completedCount} of {lessons.length} lessons
                completed
              </div>

            </div>

            <div
              className="h-2 bg-gray-200 rounded-full overflow-hidden"
              role="progressbar"
              aria-label="Overall progress"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >

              <div
                className="h-full bg-[#0F4C3A] rounded-full transition-all duration-500 motion-reduce:transition-none"
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
          <div className="flex items-center justify-between mb-3">

            <p
              className="text-sm text-gray-500"
              aria-live="polite"
            >

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
              className={`text-sm text-[#0F4C3A] hover:underline rounded ${FOCUS_RING}`}
            >
              Clear filters
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* CATEGORY QUICK NAVIGATION */}
        {/* ================================================= */}

        {!isFiltering && (
          <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-sm py-2.5 mb-5 border-b border-gray-100">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

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
                    title={`Jump to ${category}`}
                    className={`text-left rounded-lg border border-gray-200 bg-white hover:border-[#0F4C3A]/30 hover:bg-gray-50/60 transition-colors duration-150 motion-safe:active:scale-[0.98] px-3 py-2.5 ${FOCUS_RING}`}
                  >

                    <div className="flex items-center justify-between gap-2">

                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {category}
                      </p>

                      {categoryCompleted ===
                        categoryLessons.length && (
                        <CheckCircle2
                          size={16}
                          className="text-[#0F4C3A] shrink-0"
                        />
                      )}

                    </div>

                    <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
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
          <div className="py-10 text-center">

            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">

              <Search
                size={18}
                className="text-gray-400"
              />

            </div>

            <h3 className="font-semibold text-gray-900 mb-1">
              No lessons found
            </h3>

            <p className="text-sm text-gray-500 mb-3">
              Try a different search term or category.
            </p>

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className={`text-sm font-medium text-[#0F4C3A] hover:underline rounded ${FOCUS_RING}`}
            >
              Clear filters
            </button>

          </div>
        )}

        {/* ================================================= */}
        {/* LESSON CATEGORIES */}
        {/* ================================================= */}

        {filteredLessons.length > 0 && (
          <div className="space-y-7">

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
                  className="scroll-mt-24"
                >

                  {/* Category Header */}

                  <div className="flex items-baseline justify-between gap-3 mb-3">

                    <h2 className="text-xl font-semibold text-gray-900">
                      {category}
                    </h2>

                    <p className="text-sm text-gray-500 tabular-nums shrink-0">
                      {categoryCompleted} of{" "}
                      {categoryLessons.length} completed
                    </p>

                  </div>

                  {/* Lesson Cards */}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

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
                          className={`group h-full flex flex-col text-left rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-[#0F4C3A]/30 hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.99] ${FOCUS_RING}`}
                        >

                          {/* Icon + Title + Description */}

                          <div className="flex items-start gap-3">

                            <div className="w-9 h-9 shrink-0 rounded-lg bg-[#0F4C3A]/10 flex items-center justify-center">

                              {isCompleted ? (
                                <CheckCircle2
                                  size={18}
                                  className="text-[#0F4C3A]"
                                />
                              ) : (
                                <BookOpen
                                  size={18}
                                  className="text-[#0F4C3A]"
                                />
                              )}

                            </div>

                            <div className="min-w-0 flex-1">

                              <h3 className="font-semibold text-lg leading-snug text-gray-900 mb-1 group-hover:text-[#0F4C3A] transition-colors">
                                {lesson.title}
                              </h3>

                              <p
                                className="text-sm text-gray-500 leading-5 line-clamp-2"
                                title={lesson.description}
                              >
                                {lesson.description}
                              </p>

                            </div>

                          </div>

                          {/* Metadata */}

                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-3">

                            <span>
                              {lesson.difficulty}
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock3 size={13} />
                              {lesson.estimated_minutes} min
                            </span>

                            {isCompleted && (
                              <span className="ml-auto font-medium text-[#0F4C3A]">
                                Completed
                              </span>
                            )}

                          </div>

                          {/* Progress */}

                          <div className="flex items-center gap-2 mt-auto pt-3">

                            <span className="sr-only">
                              Progress
                            </span>

                            <div
                              className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >

                              <div
                                className="h-full bg-[#0F4C3A] rounded-full transition-all duration-500 motion-reduce:transition-none"
                                style={{
                                  width: `${percent}%`,
                                }}
                              />

                            </div>

                            <span className="text-xs text-gray-500 tabular-nums w-8 text-right">
                              {percent}%
                            </span>

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