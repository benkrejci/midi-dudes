import { ActiveNote, LogLevel, MidiInput } from './MidiInput'
import { ScreenBuffer, ScreenBufferHD, terminal } from 'terminal-kit'

import dayjs from 'dayjs'

console.log('Starting MidiInput listener')

const midiInput = MidiInput.create()

let activeNotes: Map<number, ActiveNote>

midiInput.on('update', () => (activeNotes = midiInput.getActiveNotes()))

interface LogLine {
    level: LogLevel
    message: string
    args?: any[]
    next?: LogLine
}

let firstLogLine: LogLine

const log = (level: LogLevel, message: string, ...args: any[]) => {
    firstLogLine = {
        level,
        message,
        args,
        next: firstLogLine,
    }
}

midiInput.on('log', (...args) => log(...args))
;['SIGINT', 'SIGTERM'].forEach((eventName) =>
    process.on(eventName, () => {
        console.log(`Caught ${eventName}, exiting.`)
        terminal.clear().hideCursor(false)
        clearInterval(renderInterval)
        midiInput.destroy()
    })
)

const ROLL_MIN_NOTE = 21
const ROLL_MAX_NOTE = 108
const PIANO_ROLL_HEIGHT = 5

terminal.clear().hideCursor(true)
const FPS_INTERVAL = 300
let frameCount = 0
let lastFpsTime: number = 0
const renderInterval = setInterval(() => {
    printPianoRoll()

    const t = Number(process.hrtime.bigint()) / 1e6
    const dt = t - lastFpsTime
    frameCount++
    if (dt >= FPS_INTERVAL) {
        terminal
            .moveTo(
                0,
                PIANO_ROLL_HEIGHT + 1,
                `fps: ${((frameCount / dt) * 1000).toPrecision(3)}`
            )
            .eraseLineAfter()
        frameCount = 0
        lastFpsTime = t
    }

    printLog()
})

const pianoRollBuffer = new ScreenBufferHD({
    dst: terminal,
    x: 1,
    y: 1,
    height: PIANO_ROLL_HEIGHT,
})

const logBuffer = new ScreenBuffer({
    dst: terminal,
    x: 1,
    y: PIANO_ROLL_HEIGHT + 2,
})

/*
    1 3   6 8 10
0 ┌┌─╥─┐┬┌─╥─╥─┐┐
1 ││ ║ │││ ║ ║ ││
2 │└┬╨┬┘│└┬╨┬╨┬┘│
3 │ │ │ │ │ │ │ │
4 └─┴─┴─┴─┴─┴─┴─┘
   0 2 4 5 7 9 11
*/
const printPianoRoll = () => {
    const lines = ['', '', '', '', '']
    let x = 0
    for (let note = ROLL_MIN_NOTE; note < ROLL_MAX_NOTE; note++) {
        const position = note % 12
        let columns: string[][]
        const activeNote = activeNotes?.get(note)
        const amplitude = getNoteAmplitude(activeNote)
        const activeChar = getAmplitudeGlyph(amplitude)
        let activeRow: number

        // natural keys
        if (position === 0 || position === 5) {
            columns = [['┌', '│', '└', activeChar, '─']]
            activeRow = 3
        } else if (position === 4 || position === 11) {
            columns = [
                ['┐', '│', '┘', activeChar, '─'],
                ['┬', '│', '│', '│', '┴'],
            ]
            activeRow = 3
        } else if (position === 2 || position === 7 || position === 9) {
            columns = [['╥', '║', '╨', activeChar, '─']]
            activeRow = 3
            // accidental keys
        } else if (position === 1 || position === 6) {
            columns = [['─', activeChar, '┬', '│', '┴']]
            activeRow = 1
        } else if (position === 3 || position === 10) {
            columns = [['─', activeChar, '┬', '│', '┴']]
            activeRow = 1
        } else {
            // (position === 8)
            columns = [['─', activeChar, '┬', '│', '┴']]
            activeRow = 1
        }

        columns.forEach((column) =>
            pianoRollBuffer.put(
                // @ts-ignore @types/terminal-kit is not up-to-date and every time I put in a pull request on DefinitelyTyped
                // it just sits around forever and gets abandoned 🤷
                {
                    x: x++,
                    y: 0,
                    direction: 'down',
                },
                column.join('')
            )
        )
    }
    pianoRollBuffer.draw({ delta: true })
}

const ACTIVE_NOTE_GLYPHS = [' ', '░', '▒', '▓', '█']
const getAmplitudeGlyph = (amplitude?: number): string => {
    if (!amplitude) return ' '
    const glyphIndex = Math.ceil(amplitude * (ACTIVE_NOTE_GLYPHS.length - 1))
    return ACTIVE_NOTE_GLYPHS[glyphIndex]
}

const DECAY = 2 * 1000
const SUSTAIN = 0.2
const getNoteAmplitude = (activeNote?: ActiveNote): number => {
    if (!activeNote) return 0
    const t = Number(process.hrtime.bigint()) / 1e6 - activeNote.startTime
    if (t >= DECAY) return SUSTAIN
    return (t * -(1 - SUSTAIN)) / DECAY + 1
}

const LOG_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss Z'
const getLogLine = (logLine: LogLine) =>
    `[${dayjs().format(LOG_DATE_TIME_FORMAT)}][${logLine.level}][MidiInput] ${
        logLine.message
    } ${logLine.args?.join(', ')}`

let prevFirstLogLine: LogLine
const printLog = () => {
    // if no new logs, don't print
    if (prevFirstLogLine === firstLogLine) return
    prevFirstLogLine = firstLogLine

    const height = terminal.height - PIANO_ROLL_HEIGHT - 1
    let y = 0
    let currentLogLine: LogLine | undefined = firstLogLine
    while (currentLogLine) {
        logBuffer.put(
            // @ts-ignore
            { x: 0, y: y },
            getLogLine(currentLogLine).padEnd(terminal.width, ' ')
        )
        if (y >= height - 1) {
            delete currentLogLine.next
            break
        }
        currentLogLine = currentLogLine.next
        y++
    }
    logBuffer.draw({ delta: true })
}
