import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";

import {
  getLearningContent,
  getLearningLesson,
  getLearningProgress,
  updateLearningProgress,
} from "../../services/learnService";

type ContentBlock =
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

type Lesson = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  content: ContentBlock[];
  difficulty: string;
  estimated_minutes: number;
};

type LessonSummary = {
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

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLesson() {
      if (!slug) return;

      try {
        setLoading(true);
        setError("");
        setCompleted(false);

        const [lessonData, contentData, progressData] =
          await Promise.all([
            getLearningLesson(slug),
            getLearningContent(),
            getLearningProgress(),
          ]);

        setLesson(lessonData);
        setLessons(contentData.content || []);
        setProgress(progressData.progress || []);

        const currentProgress = (progressData.progress || []).find(
          (item: Progress) => item.content_id === lessonData.id
        );

        setCompleted(currentProgress?.completed === true);
      } catch (err) {
        console.error("Lesson loading error:", err);
        setError("Unable to load this lesson.");
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [slug]);

  const orderedLessons = useMemo(() => {
    return [...lessons].sort(
      (a, b) => a.display_order - b.display_order
    );
  }, [lessons]);

  const currentIndex = useMemo(() => {
    if (!slug) return -1;

    return orderedLessons.findIndex(
      (item) => item.slug === slug
    );
  }, [orderedLessons, slug]);

  const currentLessonNumber =
    currentIndex >= 0 ? currentIndex + 1 : 0;

  const totalLessons = orderedLessons.length;

  const previousLesson =
    currentIndex > 0
      ? orderedLessons[currentIndex - 1]
      : null;

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < orderedLessons.length - 1
      ? orderedLessons[currentIndex + 1]
      : null;

  const currentProgress = lesson
    ? progress.find(
        (item) => item.content_id === lesson.id
      )?.progress_percent || 0
    : 0;

  async function handleComplete() {
    if (!lesson || completing || completed) return;

    try {
      setCompleting(true);
      setError("");

      await updateLearningProgress(lesson.id, 100);

      setCompleted(true);

      setProgress((previous) => {
        const existing = previous.find(
          (item) => item.content_id === lesson.id
        );

        if (existing) {
          return previous.map((item) =>
            item.content_id === lesson.id
              ? {
                  ...item,
                  progress_percent: 100,
                  completed: true,
                }
              : item
          );
        }

        return [
          ...previous,
          {
            content_id: lesson.id,
            progress_percent: 100,
            completed: true,
          },
        ];
      });
    } catch (err) {
      console.error("Progress update error:", err);
      setError("Unable to save your progress.");
    } finally {
      setCompleting(false);
    }
  }

  function handlePrevious() {
    if (!previousLesson) return;

    navigate(`/learn/${previousLesson.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    if (!nextLesson) return;

    navigate(`/learn/${nextLesson.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">
          Loading lesson...
        </p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-red-500">
          {error || "Lesson not found."}
        </p>

        <button
          onClick={() => navigate("/learn")}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          Back to Learn
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ===================================================== */}
      {/* TOP BAR */}
      {/* ===================================================== */}

      <div className="border-b border-gray-100 bg-white">

        <div className="max-w-4xl mx-auto px-5 sm:px-6">

          <div className="h-14 flex items-center justify-between">

            <button
              onClick={() => navigate("/learn")}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition"
            >
              <ArrowLeft size={16} />
              <span>Learn</span>
            </button>

            <span className="text-xs text-gray-400">
              Lesson {currentLessonNumber} of {totalLessons}
            </span>

          </div>

          {/* Progress */}

          <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-0">

            <div
              className="h-full bg-[#0F4C3A] transition-all duration-500"
              style={{
                width: `${currentProgress}%`,
              }}
            />

          </div>

        </div>

      </div>

      {/* ===================================================== */}
      {/* MAIN CONTENT */}
      {/* ===================================================== */}

      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <header className="mb-8">

          <div className="flex items-center gap-2 text-xs font-medium text-[#0F4C3A] mb-3">
            <BookOpen size={15} />
            {lesson.category}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-3">
            {lesson.title}
          </h1>

          <p className="text-gray-500 leading-7 text-[15px] max-w-2xl">
            {lesson.description}
          </p>

          <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">

            <span>
              {lesson.difficulty}
            </span>

            <span className="w-1 h-1 rounded-full bg-gray-300" />

            <span className="flex items-center gap-1">
              <Clock3 size={13} />
              {lesson.estimated_minutes} min
            </span>

            {completed && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300" />

                <span className="flex items-center gap-1 text-[#0F4C3A]">
                  <CheckCircle2 size={13} />
                  Completed
                </span>
              </>
            )}

          </div>

        </header>

        {/* ================================================= */}
        {/* CONTENT */}
        {/* ================================================= */}

        <article className="space-y-6">

          {lesson.content?.map((block, index) => {

            if (block.type === "heading") {
              return (
                <h2
                  key={index}
                  className="text-xl font-semibold text-gray-900 pt-3"
                >
                  {block.text}
                </h2>
              );
            }

            if (block.type === "paragraph") {
              return (
                <p
                  key={index}
                  className="text-[15px] leading-7 text-gray-600"
                >
                  {block.text}
                </p>
              );
            }

            if (block.type === "formula") {
              return (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4"
                >
                  <p className="font-mono text-sm text-[#0F4C3A]">
                    {block.text}
                  </p>
                </div>
              );
            }

            if (block.type === "key_points") {
              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                >

                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Key Points
                  </h3>

                  <ul className="space-y-2">

                    {block.items.map(
                      (item, itemIndex) => (
                        <li
                          key={itemIndex}
                          className="flex items-start gap-2.5 text-sm leading-6 text-gray-600"
                        >
                          <span className="text-[#0F4C3A] mt-0.5">
                            •
                          </span>

                          <span>{item}</span>
                        </li>
                      )
                    )}

                  </ul>

                </div>
              );
            }

            return null;
          })}

        </article>

        {/* ================================================= */}
        {/* COMPLETE */}
        {/* ================================================= */}

        <div className="mt-8 pt-6 border-t border-gray-100">

          {completed ? (

            <div className="flex items-center gap-2 text-sm text-[#0F4C3A]">
              <CheckCircle2 size={18} />
              <span className="font-medium">
                Lesson completed
              </span>
            </div>

          ) : (

            <button
              onClick={handleComplete}
              disabled={completing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-sm font-medium hover:bg-[#0b3d2f] disabled:opacity-50 transition"
            >
              <Check size={16} />

              {completing
                ? "Saving..."
                : "Mark as Complete"}
            </button>

          )}

          {error && (
            <p className="text-xs text-red-500 mt-3">
              {error}
            </p>
          )}

        </div>

        {/* ================================================= */}
        {/* PREVIOUS / NEXT */}
        {/* ================================================= */}

        <div className="mt-7 pt-5 border-t border-gray-100">

          <div className="flex items-center justify-between gap-4">

            {/* Previous */}

            {previousLesson ? (

              <button
                onClick={handlePrevious}
                className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition min-w-0"
              >

                <ChevronLeft
                  size={17}
                  className="shrink-0"
                />

                <span className="truncate">
                  Previous
                </span>

              </button>

            ) : (
              <div />
            )}

            {/* Next */}

            {nextLesson ? (

              <button
                onClick={handleNext}
                className="group flex items-center gap-2 text-sm font-medium text-[#0F4C3A] hover:text-[#0b3d2f] transition min-w-0"
              >

                <span className="truncate">
                  Next: {nextLesson.title}
                </span>

                <ChevronRight
                  size={17}
                  className="shrink-0"
                />

              </button>

            ) : (

              <button
                onClick={() => navigate("/learn")}
                className="flex items-center gap-2 text-sm font-medium text-[#0F4C3A] hover:text-[#0b3d2f] transition"
              >
                Finish
                <ArrowRight size={16} />
              </button>

            )}

          </div>

        </div>

      </main>
    </div>
  );
}