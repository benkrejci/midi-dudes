import _, { get } from 'lodash'
import { terminal } from 'terminal-kit'
import convert from 'color-convert'

import { getLedController } from '@benkrejci/led-dudes/dist/led-controller'
import { ActiveNote, MidiInput } from './MidiInput'
import * as color from './utility/color'
import * as leds from './utility/leds'

import * as curves from './utility/curves'
import * as constants from './constants'
import { EnvelopedNote } from './utility/envelope'

const CURSOR_RGB: color.Rgb = color.to8BitRgb(
    convert.hsv.rgb([0, constants.CURSOR_SATURATION, 100])
)
const BACKGROUND_DEFAULT_RGB: color.Rgb = color.to8BitRgb(
    convert.hsv.rgb([0, 75, 4])
)
const clampBackground = (value: number): number =>
    curves.linear(
        value,
        0,
        255,
        constants.BACKGROUND_MIN,
        constants.BACKGROUND_MAX
    )
const LOWS_RGB: color.Rgb = color
    .to8BitRgb(
        convert.hsv.rgb([
            360 - constants.LOW_HIGH_HUE_OFFSET,
            constants.BACKGROUND_SATURATION,
            100,
        ])
    )
    .map(clampBackground)
const HIGHS_RGB: color.Rgb = color
    .to8BitRgb(
        convert.hsv.rgb([
            constants.LOW_HIGH_HUE_OFFSET,
            constants.BACKGROUND_SATURATION,
            100,
        ])
    )
    .map(clampBackground)

const ledController = getLedController({
    ledType: constants.LED_TYPE,
    colorOrder: 'grb',
    stripLength: constants.LED_STRIP_LENGTH,
})
const midiInput = MidiInput.create()

//midiInput.on('log', (level, message, ...args) => console[level](message, ...args))

export interface CurveParams {
    scale?: number
    sigmoid?: number
    power?: number
}

interface MoodListItem {
    activeNote: ActiveNote
    //previous?: MoodListItem
    next?: MoodListItem
}
let moodListFirst: MoodListItem | undefined
let moodListLast: MoodListItem | undefined
//const moodMap: Map<number, MoodListItem> = new Map()
const addMoodItem = (activeNote: ActiveNote) => {
    if (!moodListFirst || !moodListLast) {
        moodListFirst = moodListLast = { activeNote }
    } else {
        moodListLast.next = { activeNote } //, previous: moodListLast }
        moodListLast = moodListLast.next
    }
    // moodMap.set(activeNote.note, moodListLast)
}
const removeMoodItem = (moodItem: MoodListItem) => {
    if (!moodItem || moodItem !== moodListFirst) return
    moodListFirst = moodListFirst.next
    // if (moodItem.previous) moodItem.previous.next = moodItem.next
    // if (moodItem.next) moodItem.next.previous = moodItem.previous
    // moodMap.delete(note)
}

export let activeNotes: Map<number, EnvelopedNote> = new Map()
midiInput.on('add', (activeNote) => {
    const existingNote = activeNotes.get(activeNote.note)
    if (existingNote) existingNote.setActiveNote(activeNote)
    else activeNotes.set(activeNote.note, new EnvelopedNote(activeNote))

    // update moving average queues
    addMoodItem(activeNote)
})
midiInput.on('remove', (activeNote) => {
    const releasableNote = activeNotes.get(activeNote.note)
    if (releasableNote)
        releasableNote.stopTime = Number(process.hrtime.bigint()) / 1e6
    // removeMoodItem(activeNote.note)
})

type MoodParam = 'force' | 'speed' | 'lows' | 'highs'

type MoodParams<T = number> = Record<MoodParam, T>

type GetValueWithNoteIndex = (
    noteIndex: number,
    total: number,
    config: MoodConfig,
    t: number
) => number

interface MoodConfig {
    name: MoodParam
    type: 'foreground' | 'background' | 'hue' | 'scale' | 'backgroundScale'
    noLimit?: boolean
    rgb?: color.Rgb
    movingAveragePeriod: number
    maxRateOfChangeUp?: number
    maxRateOfChangeDown?: number
    reduceMoodListItem: (
        total: number,
        currentItem: MoodListItem,
        lastItem: MoodListItem | undefined,
        timeLeftInPeriod: number,
        config: MoodConfig
    ) => number
    getValue?: (total: number, config: MoodConfig, t: number) => number
    getValueWithNoteIndex?: GetValueWithNoteIndex
}

const MOOD_CONFIGS: MoodConfig[] = [
    {
        name: 'force',
        type: 'backgroundScale',
        movingAveragePeriod: 20 * 1000,
        reduceMoodListItem: (
            total,
            currentItem,
            lastItem,
            timeLeftInPeriod: number,
            config: MoodConfig
        ) =>
            Math.max(
                total,
                ((currentItem.activeNote.velocity / constants.VELOCITY_MAX) *
                    timeLeftInPeriod) /
                    config.movingAveragePeriod
            ),
        getValue: (total) => curves.parabolic(total, 3, 0.3, 0.9, 0.2, 1),
    },
    {
        name: 'speed',
        type: 'hue',
        noLimit: true,
        movingAveragePeriod: constants.SPEED_MOVING_AVERAGE_PERIOD,
        maxRateOfChangeDown: constants.SPEED_MAX_RATE_DOWN,
        maxRateOfChangeUp: constants.SPEED_MAX_RATE_UP,
        reduceMoodListItem: (total, currentItem, lastItem) =>
            total +
            (currentItem.activeNote.note > constants.SPEED_NOTE_MIN &&
            (!lastItem ||
                currentItem.activeNote.startTime -
                    lastItem.activeNote.startTime >
                    30)
                ? 1
                : 0),
        getValue: (total, config, t) =>
            curves.parabolic(
                total / config.movingAveragePeriod,
                constants.SPEED_HUE_EXP,
                constants.SPEED_HUE_START,
                constants.SPEED_HUE_END,
                constants.SPEED_HUE_MIN,
                constants.SPEED_HUE_MAX
            ),
        //TIME_SCALE * t,
    },
    {
        name: 'lows',
        type: 'background',
        rgb: LOWS_RGB,
        movingAveragePeriod: 5e3,
        reduceMoodListItem: (
            total,
            currentItem,
            lastItem,
            timeLeftInPeriod,
            config
        ) =>
            total +
            (curves.parabolic(currentItem.activeNote.note, 2.5, 60, 30) *
                timeLeftInPeriod) /
                config.movingAveragePeriod,
        getValueWithNoteIndex: (noteIndex, total) =>
            curves.parabolic(total, 2, 0, 1) *
            curves.parabolic(noteIndex, 2, 70, 30),
    },
    {
        name: 'highs',
        type: 'background',
        rgb: HIGHS_RGB,
        movingAveragePeriod: 8 * 1000,
        reduceMoodListItem: (
            total,
            currentItem,
            lastItem,
            timeLeftInPeriod,
            config
        ) =>
            total +
            (curves.parabolic(currentItem.activeNote.note, 2.5, 60, 90) *
                timeLeftInPeriod) /
                config.movingAveragePeriod,
        getValueWithNoteIndex: (noteIndex, total) =>
            curves.parabolic(total, 2, 0, 1) *
            curves.parabolic(noteIndex, 2, 50, 90),
    },
]

const moodConfigWithNoteIndex = MOOD_CONFIGS.filter(
    (config) => config.getValueWithNoteIndex
)

let lastMoodParams: MoodParams = {
    force: 0,
    speed: 0,
    lows: 0,
    highs: 0,
}

interface Mood {
    backgroundScale: number
    backgroundRgb: color.Rgb
    totals: MoodParams
    hue: number
    scale: number
}

let lastMoodTime = 0

const getMood = (t: number): Mood => {
    const dt = t - lastMoodTime
    lastMoodTime = t

    let currentItem = moodListFirst
    const totals: MoodParams = {
        force: 0,
        speed: 0,
        lows: 0,
        highs: 0,
    }
    let lastItem: MoodListItem | undefined
    while (currentItem) {
        const dt = t - currentItem.activeNote.startTime
        let numWithinPeriod = 0
        for (let config of MOOD_CONFIGS) {
            const timeLeftInPeriod = config.movingAveragePeriod - dt
            if (timeLeftInPeriod > 0) {
                numWithinPeriod++
                totals[config.name] = config.reduceMoodListItem(
                    totals[config.name] || 0,
                    currentItem,
                    lastItem,
                    timeLeftInPeriod,
                    config
                )
            }
        }
        if (!numWithinPeriod) removeMoodItem(currentItem)
        lastItem = currentItem
        currentItem = currentItem.next
    }

    let backgroundRgb: color.Rgb = color.to8BitRgb([0, 0, 0])
    const hues: number[] = []
    const scales: number[] = []
    const backgroundScales: number[] = []
    for (const config of MOOD_CONFIGS) {
        const total = totals[config.name]
        if (!config.getValue && !config.getValueWithNoteIndex) {
            throw new TypeError(
                `Config must provide either getValueWithNoteIndex or getValue function`
            )
        } else if (config.getValue) {
            let amplitude = config.getValue(total, config, t)
            amplitude = lastMoodParams[config.name] = curves.approach(
                lastMoodParams[config.name],
                amplitude,
                (config.maxRateOfChangeUp ||
                    constants.MAX_RATE_OF_CHANGE_UP_DEFAULT) * dt,
                (config.maxRateOfChangeDown ||
                    constants.MAX_RATE_OF_CHANGE_DOWN_DEFAULT) * dt
            )
            if (config.type === 'background') {
                backgroundRgb = <color.Rgb>backgroundRgb.map(
                    (value, colorIndex) => {
                        if (!config.rgb || isNaN(config.rgb[colorIndex]))
                            throw new TypeError(
                                `Missing required rgb prop on ${config.type} config`
                            )
                        return value + config.rgb[colorIndex] * amplitude
                    }
                )
            } else if (config.type === 'hue') {
                hues.push(amplitude)
            } else if (config.type === 'scale') {
                scales.push(amplitude)
            } else if (config.type === 'backgroundScale') {
                backgroundScales.push(amplitude)
            }
        }
    }

    let backgroundScale = 1
    if (backgroundScales.length) {
        backgroundScale =
            backgroundScales.reduce((previous, current) => previous + current) /
            backgroundScales.length
        backgroundRgb = <color.Rgb>(
            backgroundRgb.map((value) => value * backgroundScale)
        )
    }

    backgroundRgb = color.defaultBlendRgb(
        backgroundRgb,
        BACKGROUND_DEFAULT_RGB
        // color.rotateHue(
        //     BACKGROUND_DEFAULT_RGB,
        //     color.getHueMatrix(t * constants.TIME_SCALE)
        // )
    )

    return {
        backgroundScale,
        backgroundRgb,
        totals,
        scale: !scales.length
            ? 1
            : scales.reduce((previous, current) => previous + current) /
              scales.length,
        hue: !hues.length
            ? 0
            : hues.reduce((previous, current) => previous + current) /
              hues.length,
    }
}

let frameCount = 0
let lastFpsTime: number = 0
if (constants.DEBUG) terminal.clear()

setInterval(() => {
    const t = Number(process.hrtime.bigint()) / 1e6

    const { backgroundRgb, backgroundScale, totals, scale, hue } = getMood(t)

    const hueMatrix: number[][] = color.getHueMatrix(hue)

    // calculate active note colors
    let noteColors: leds.NoteColor[] = []
    for (const activeNote of activeNotes.values()) {
        const center = noteToLedIndex(activeNote.activeNote.note)
        const amplitude = activeNote.getAmplitude()
        noteColors.push({
            rgb: <color.Rgb>CURSOR_RGB.map((value) => amplitude * value),
            ledIndex: center,
        })
    }

    // sort in reverse order so we can pop stuff
    noteColors = noteColors.sort((a, b) => b.ledIndex - a.ledIndex)
    for (let ledIndex = 0; ledIndex < constants.LED_STRIP_LENGTH; ledIndex++) {
        let currentColor: color.Rgb = backgroundRgb
        const noteIndex = ledToNoteIndex(ledIndex)

        for (const config of moodConfigWithNoteIndex) {
            const configRgb = config.rgb
            if (config.getValueWithNoteIndex && configRgb) {
                const total = totals[config.name]
                const amplitude = config.getValueWithNoteIndex(
                    noteIndex,
                    total,
                    config,
                    t
                )
                currentColor = currentColor.map(
                    (value, colorIndex) =>
                        value +
                        backgroundScale * amplitude * configRgb[colorIndex]
                )
            }
        }

        for (
            let noteColorIndex = noteColors.length - 1;
            noteColorIndex >= 0;
            noteColorIndex--
        ) {
            const noteColor = noteColors[noteColorIndex]
            const distance = noteColor.ledIndex - ledIndex
            if (distance >= constants.LED_NOTE_WIDTH) {
                break
            } else if (distance < -constants.LED_NOTE_WIDTH) {
                noteColors.pop()
            } else {
                currentColor = <color.Rgb>(
                    leds
                        .antialias(ledIndex, noteColor)
                        .map((value, index) => currentColor[index] + value)
                )
            }
        }

        currentColor = color.rotateHue(currentColor, hueMatrix)

        ledController.setPixel(
            constants.LED_REVERSE
                ? constants.LED_STRIP_LENGTH - ledIndex
                : ledIndex,
            ...color.toFloatRgb(color.gammaColor(currentColor))
        )
    }
    ledController.update()

    if (constants.DEBUG) {
        const dt = t - lastFpsTime
        frameCount++
        if (dt >= constants.DEBUG_INTERVAL) {
            const fpsString = `fps: ${debugNum((frameCount / dt) * 1000)}`
            if (constants.DEBUG_TERMINAL_KIT) {
                terminal
                    .moveTo(1, 1, fpsString)
                    .eraseLineAfter()
                    .moveTo(
                        1,
                        2,
                        `mood: ${JSON.stringify(
                            Object.fromEntries(
                                Object.entries(lastMoodParams).map(([k, v]) => [
                                    k,
                                    debugNum(v),
                                ])
                            )
                        )}`
                    )
                    .eraseLineAfter()
                    .moveTo(1, 3, `hue: ${debugNum(hue)}`)
                    .eraseLineAfter()
            } else {
                console.log(fpsString)
            }
            frameCount = 0
            lastFpsTime = t
        }
    }
}, 1000 / constants.MAX_FRAME_RATE)

const noteToLedIndex = (note: number): number =>
    ((note - constants.MIDI_NOTE_MIN) /
        (constants.MIDI_NOTE_MAX - constants.MIDI_NOTE_MIN)) *
    constants.LED_STRIP_LENGTH

const ledToNoteIndex = (led: number): number =>
    (led / constants.LED_STRIP_LENGTH) *
        (constants.MIDI_NOTE_MAX - constants.MIDI_NOTE_MIN) +
    constants.MIDI_NOTE_MIN

const debugNum = (num: number) => {
    const mod = num % 1
    const base = num - mod
    return (
        String(base).padStart(4) +
        '.' +
        String(Math.abs(Math.round(mod * 100))).padStart(2, '0')
    )
}
