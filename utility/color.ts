import _ from 'lodash'
import * as constants from '../constants'

export type FloatRgb<T = number> = [T, T, T] // red, green, blue
export type Rgb = Uint8ClampedArray

export const to8BitRgb = (rgb: FloatRgb): Rgb =>
    new Uint8ClampedArray([rgb[0], rgb[1], rgb[2]])
export const toFloatRgb = (rgb: Rgb | FloatRgb): FloatRgb => [
    rgb[0],
    rgb[1],
    rgb[2],
]

export const defaultBlendRgb = (base: Rgb, blend: Rgb): Rgb => {
    const blendSum = blend.reduce((a, p) => a + p)
    let difference = blendSum - base.reduce((a, p) => a + p)
    if (difference <= 0) return base
    difference /= blendSum
    return <Rgb>base.map((value, index) => value + difference * blend[index])
}

export const gammaColor = (rgb: Rgb): Rgb => <Rgb>rgb.map(gamma)

export const gamma = (value: number): number =>
    255 * (value / 255) ** constants.GAMMA_CONSTANT

const IRREGULAR_COEFFICIENT_0 = 1
const IRREGULAR_COEFFICIENT_1 = 1.1371371
const IRREGULAR_COEFFICIENT_2 = 1.2090909

export const getMorphHue = (t: number): Rgb =>
    <Rgb>(
        new Uint8ClampedArray([
            Math.sin(
                (constants.TIME_SCALE * IRREGULAR_COEFFICIENT_0 * t) / Math.PI
            ),
            Math.sin(
                (constants.TIME_SCALE * IRREGULAR_COEFFICIENT_1 * t) / Math.PI
            ),
            Math.sin(
                (constants.TIME_SCALE * IRREGULAR_COEFFICIENT_2 * t) / Math.PI
            ),
        ]).map((value) => 0.5 * value + 0.5)
    )

const K0 = 1 / 3
const K1 = Math.sqrt(K0)
export const getHueMatrix = (radians: number): number[][] => {
    const p0 = Math.cos(radians)
    const p1 = Math.sin(radians)
    return [
        [p0 + (1 - p0) / 3, K0 * (1 - p0) - K1 * p1, K0 * (1 - p0) + K1 * p1],
        [K0 * (1 - p0) + K1 * p1, p0 + K0 * (1 - p0), K0 * (1 - p0) - K1 * p1],
        [K0 * (1 - p0) - K1 * p1, K0 * (1 - p0) + K1 * p1, p0 + K0 * (1 - p0)],
    ]
}

export const rotateHue = (rgb: Rgb, hueMatrix: number[][]): Rgb =>
    new Uint8ClampedArray([
        rgb[0] * hueMatrix[0][0] +
            rgb[1] * hueMatrix[0][1] +
            rgb[2] * hueMatrix[0][2],
        rgb[0] * hueMatrix[1][0] +
            rgb[1] * hueMatrix[1][1] +
            rgb[2] * hueMatrix[1][2],
        rgb[0] * hueMatrix[2][0] +
            rgb[1] * hueMatrix[2][1] +
            rgb[2] * hueMatrix[2][2],
    ])
