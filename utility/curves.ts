// https://en.wikipedia.org/wiki/Logistic_function
// magic number 12 serves to normalize width to 1 based on the fact that the logistic function roughly converges at [-6, +6]
// 0.5 * width term pushes S to the right so left convergence is around 0
// play with this curve here: https://www.desmos.com/calculator/krliudqplv
export const logistic = (x: number, width: number) =>
    1 / (1 + Math.pow(Math.E, (-12 / width) * (x - 0.5 * width)))

export const approach = (
    current: number,
    target: number,
    maxRateOfChangeUp: number,
    maxRateOfChangeDown: number
): number => {
    const change = (target - current) / 2
    if (change > 0) return current + Math.min(maxRateOfChangeUp, change)
    else return current - Math.min(maxRateOfChangeDown, -change)
}

export const linear = (
    x: number,
    start: number = 0,
    end: number = 1,
    min: number = 0,
    max: number = 1
): number =>
    bounds(
        x,
        () => ((max - min) * (x - start)) / (end - start) + min,
        start,
        end,
        min,
        max
    )

export const parabolic = (
    x: number,
    exp: number = 2,
    start: number = 0,
    end: number = 1,
    min: number = 0,
    max: number = 1
) =>
    bounds(
        x,
        () => (max - min) * Math.pow((x - start) / (end - start), exp) + min,
        start,
        end,
        min,
        max
    )

export const bounds = (
    x: number,
    calc: () => number,
    start: number = 0,
    end: number = 1,
    min: number = 0,
    max: number = 1
): number => {
    if (end > start) {
        if (x < start) return min
        if (x > end) return max
    } else if (end < start) {
        if (x > start) return min
        if (x < end) return max
    }
    return calc()
}
