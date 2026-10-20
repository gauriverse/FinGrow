import math

from app.ml.fuzzy_risk import assess_fuzzy_risk


def get_result(volatility, momentum, drawdown):
    """Evaluate one input combination and validate its output."""

    result = assess_fuzzy_risk(
        volatility,
        momentum,
        drawdown,
    )

    score = float(result.risk_score)
    category = result.risk_category

    assert math.isfinite(score), (
        f"Non-finite score for inputs: "
        f"{volatility}, {momentum}, {drawdown}"
    )
    assert 0 <= score <= 100, (
        f"Score outside 0–100: {score}"
    )
    assert category in {"Low", "Moderate", "High"}, (
        f"Unexpected category: {category}"
    )

    return score, category


def run_sweep(title, input_name, values, fixed_inputs):
    """Vary one input while holding the other two constant."""

    print(f"\n{'=' * 65}")
    print(title)
    print(f"Fixed inputs: {fixed_inputs}")
    print("-" * 65)

    scores = []

    for value in values:
        inputs = fixed_inputs.copy()
        inputs[input_name] = value

        score, category = get_result(
            inputs["volatility"],
            inputs["momentum"],
            inputs["drawdown"],
        )

        scores.append(score)

        print(
            f"{input_name:>10} = {value:>6} | "
            f"Score = {score:6.2f} | "
            f"Category = {category}"
        )

    print("\nChanges between consecutive scores:")

    for index in range(1, len(scores)):
        change = scores[index] - scores[index - 1]

        if change > 0.01:
            direction = "INCREASED"
        elif change < -0.01:
            direction = "DECREASED"
        else:
            direction = "UNCHANGED"

        print(
            f"{values[index - 1]} -> {values[index]}: "
            f"{change:+.2f} ({direction})"
        )


def main():
    print("FINGROW FUZZY RISK BEHAVIOR TEST")
    print("Diagnostic testing only; not predictive validation.")

    run_sweep(
        title="TEST A — Increasing volatility",
        input_name="volatility",
        values=[10, 30, 50, 70, 90],
        fixed_inputs={
            "volatility": 10,
            "momentum": -15,
            "drawdown": 5,
        },
    )

    run_sweep(
        title="TEST B — Increasing drawdown",
        input_name="drawdown",
        values=[0, 10, 20, 30, 40],
        fixed_inputs={
            "volatility": 70,
            "momentum": -10,
            "drawdown": 0,
        },
    )

    run_sweep(
        title="TEST C — Changing momentum",
        input_name="momentum",
        values=[-30, -15, 0, 15, 30],
        fixed_inputs={
            "volatility": 50,
            "momentum": -30,
            "drawdown": 10,
        },
    )
    run_sweep(
        title="TEST D — Drawdown with lower volatility",
        input_name="drawdown",
        values=[0, 5, 10, 15, 20, 25, 30, 35, 40],
        fixed_inputs={
            "volatility": 30,
            "momentum": 15,
            "drawdown": 0,
    },
    )

    print(f"\n{'=' * 65}")
    print("PASS: All tested inputs produced valid scores and categories.")
    print("Inspect the score patterns before changing any rules.")


if __name__ == "__main__":
    main()