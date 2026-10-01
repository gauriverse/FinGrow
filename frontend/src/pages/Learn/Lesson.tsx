import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3 } from "lucide-react";

import {
  getLearningLesson,
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

export default function Lesson() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
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

        const data = await getLearningLesson(slug);
        setLesson(data);
      } catch (err) {
        console.error("Lesson loading error:", err);
        setError("Unable to load this lesson.");
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [slug]);

  async function handleComplete() {
    if (!lesson || completing || completed) return;

    try {
      setCompleting(true);

      await updateLearningProgress(lesson.id, 100);

      setCompleted(true);
    } catch (err) {
      console.error("Progress update error:", err);
      setError("Unable to save your progress.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Loading lesson...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Lesson not found."}</p>

        <button
          onClick={() => navigate("/learn")}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5"
        >
          Back to Learn
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Back */}
        <button
          onClick={() => navigate("/learn")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8"
        >
          <ArrowLeft size={18} />
          Back to Learn
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-emerald-400 mb-4">
            <BookOpen size={16} />
            {lesson.category}
          </div>

          <h1 className="text-4xl font-bold mb-4">{lesson.title}</h1>

          <p className="text-gray-400 text-lg mb-5">{lesson.description}</p>

          <div className="flex items-center gap-5 text-sm text-gray-500">
            <span>{lesson.difficulty}</span>

            <span className="flex items-center gap-1">
              <Clock3 size={15} />
              {lesson.estimated_minutes} min
            </span>
          </div>
        </div>

        {/* Content */}
        <article className="space-y-8">
          {lesson.content?.map((block, index) => {
            if (block.type === "heading") {
              return (
                <h2 key={index} className="text-2xl font-semibold pt-4">
                  {block.text}
                </h2>
              );
            }

            if (block.type === "paragraph") {
              return (
                <p key={index} className="text-gray-300 leading-8 text-[16px]">
                  {block.text}
                </p>
              );
            }

            if (block.type === "formula") {
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="font-mono text-emerald-400">{block.text}</p>
                </div>
              );
            }

            if (block.type === "key_points") {
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="font-semibold mb-4">Key Points</h3>

                  <ul className="space-y-3">
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex gap-3 text-gray-300">
                        <span className="text-emerald-400 mt-1">•</span>

                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            return null;
          })}
        </article>

        {/* Completion */}
        <div className="mt-12 pt-8 border-t border-white/10">
          {completed ? (
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 size={22} />
              <span className="font-medium">Lesson completed</span>
            </div>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium transition"
            >
              {completing ? "Saving..." : "Mark as Complete"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
