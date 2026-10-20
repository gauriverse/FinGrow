from collections import Counter
from itertools import product
import math
import sys

from app.ml.fuzzy_risk import assess_fuzzy_risk


# Representative inputs covering the fuzzy system's boundaries.
VOLATILITY_VALUES = [
    0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
]

MOMENTUM_VALUES = [
    -100, -50, -20, -10, -5, 0,
    5, 10, 15, 20, 50, 100
]

DRAWDOWN_VALUES = [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50
]


def expected_category(score):
    if score < 35:
        return "Low"
    if score < 65:
        return "Moderate"
    return "High"


def main():
    tested = 0
    failures = []
    category_counts = Counter()

    combinations = product(
        VOLATILITY_VALUES,
        MOMENTUM_VALUES,
        DRAWDOWN_VALUES,
    )

    for volatility, momentum, drawdown in combinations:
        inputs = (volatility, momentum, drawdown)

        try:
            result = assess_fuzzy_risk(*inputs)
            tested += 1

            # Check that the score is a valid number.
            if not math.isfinite(result.risk_score):
                raise AssertionError(
                    f"Invalid risk score: {result.risk_score}"
                )

            if not 0 <= result.risk_score <= 100:
                raise AssertionError(
                    f"Score outside 0-100: {result.risk_score}"
                )

            # Check that the category matches the score thresholds.
            expected = expected_category(result.risk_score)

            if result.risk_category != expected:
                raise AssertionError(
                    f"Expected category {expected}, "
                    f"got {result.risk_category}"
                )

            if not result.explanation:
                raise AssertionError("Risk explanation is empty")

            category_counts[result.risk_category] += 1

        except Exception as exc:
            failures.append({
                "inputs": inputs,
                "error": f"{type(exc).__name__}: {exc}",
            })

    print(f"\nInput combinations tested: {tested + len(failures)}")
    print(f"Successful combinations: {tested}")
    print(f"Failed combinations: {len(failures)}")
    print(f"Category counts: {dict(category_counts)}")

    if failures:
        print("\nFirst 15 failures:")

        for failure in failures[:15]:
            print(failure)

        sys.exit(1)

    print(
        "\nPASS: Every tested combination produced a valid "
        "risk score, category, and explanation."
    )


if __name__ == "__main__":
    main()