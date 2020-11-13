import _ from 'lodash'
import { TypedEmitter } from 'tiny-typed-emitter'
import SerialPort from 'serialport'

interface Opts {
    serialPath: string
    serialBaudRate: number
    polyphony: number // max number of active notes that can be tracked at a time
}

const DEFAULT_OPTS: Opts = {
    serialPath: '/dev/ttyAMA0',
    serialBaudRate: 38400,
    polyphony: Infinity,
}

export interface ActiveNote {
    note: number // half-step integer, middle C is 60
    velocity: number // initial velocity integer 0 - 127
    startTime: number // epoch ms when note was activated
    isSustained: boolean // true if note has been released, but is being sustained by damper control pedal
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface MidiInputEvents {
    // update - whenever notes changes; get activeNotes by calling getActiveNotes()
    update: () => void
    // add - with ActiveNote added
    add: (note: ActiveNote) => void
    // remove - with ActiveNote removed
    remove: (note: ActiveNote) => void
    // log - emitted with log level, message, and anything else. Must be handled for logging, MidiInput does not
    // log anything by itself
    log: (level: LogLevel, message: string, ...args: any[]) => void
}

const midiInputsBySerialPath: Map<string, MidiInput> = new Map()

/**
 * Listens to MIDI messages on a serial port and keeps an internal map of notes which are currently "active"
 */
export class MidiInput extends TypedEmitter<MidiInputEvents> {
    private readonly opts: Opts
    private readonly port: SerialPort

    private isDestroyed: boolean = false
    private message: number[] = []
    private isSustainOn: boolean = false
    private activeNotes: Map<number, ActiveNote> = new Map()

    public static create(_opts: Partial<Opts> = {}): MidiInput {
        const opts: Opts = _.defaults(_opts, DEFAULT_OPTS)

        if (midiInputsBySerialPath.has(opts.serialPath)) {
            throw new Error(
                `Error creating MidiInput: an instance already exists bound to serial port ${opts.serialPath}`
            )
        }

        const midiInput = new MidiInput(opts)
        midiInputsBySerialPath.set(opts.serialPath, midiInput)

        return midiInput
    }

    public destroy(): void {
        if (this.isDestroyed)
            throw new Error(`Error destroying MidiInput: already destroyed!`)
        this.isDestroyed = true

        this.port.close()
        midiInputsBySerialPath.delete(this.opts.serialPath)
        this.removeAllListeners()
    }

    public getActiveNotes(): Map<number, ActiveNote> {
        return new Map(this.activeNotes)
    }

    private constructor(opts: Opts) {
        super()

        this.opts = opts

        this.port = new SerialPort(opts.serialPath, {
            baudRate: opts.serialBaudRate,
        })
        this.port.on('error', (error: Error) => {
            this.emit('log', 'error', error.toString())
        })
        this.port.on('data', (data: Buffer) => {
            for (let i = 0; i < data.length; i++) {
                this.gotByte(data.readUInt8(i))
            }
        })
        const updateEvents: Array<keyof MidiInputEvents> = ['add', 'remove']
        updateEvents.forEach((eventName) =>
            this.on(eventName, _.debounce(this.emit.bind(this, 'update')))
        )
    }

    private gotByte(value: number): void {
        // status byte; indicates beginning of midi message
        if (value >> 7 !== 0) {
            this.message = [value]
        } else if (!this.message) {
            this.emit(
                'log',
                'warn',
                `Invalid message part "${value}" without status message; ignoring`
            )
        } else {
            this.message.push(value)
            if (
                this.message.length === 3 || // max message length = 3
                (this.message.length === 2 && value >> 4 === 12)
            ) {
                // program change byte; indicates end of message
                this.gotMessage()
            }
        }
    }

    private gotMessage(): void {
        const type = this.message[0] >> 4
        const channel = (this.message[0] & 15) + 1
        switch (type) {
            case 9:
                this.noteOn(this.message[1], this.message[2])
                break

            case 8:
                this.noteOff(this.message[1])
                break

            case 11:
                if (this.message[1] === 64)
                    this.setSustain(this.message[2] >= 64)
                break

            case 12:
                this.emit('log', 'debug', `Program change ${this.message[1]}`)
                break

            default:
                this.emit(
                    'log',
                    'debug',
                    `Message type ${type} channel ${channel}, data: ${this.message.slice(
                        2
                    )}`
                )
        }
    }

    private noteOn(note: number, velocity: number): void {
        this.emit('log', 'debug', `Note ${note} ON, vel: ${velocity}`)

        const activeNote = {
            note,
            velocity,
            startTime: Number(process.hrtime.bigint()) / 1e+6,
            isSustained: false,
        }

        this.activeNotes.set(note, activeNote)

        // if we're over the polyphony limit
        if (this.activeNotes.size > this.opts.polyphony) {
            // delete the oldest one (Maps are in insertion order)
            const oldestActiveNote = this.activeNotes.values().next().value
            this.remove(oldestActiveNote)
        }

        this.emit('add', activeNote)
    }

    private noteOff(note: number): void {
        this.emit('log', 'debug', `Note ${note} OFF`)

        const onNote = this.activeNotes.get(note)
        if (!onNote) return // no record of this note, must have been pressed before we started listening

        // if sustain pedal is pressed, keep this note going and mark it as being sustained
        if (this.isSustainOn) {
            onNote.isSustained = true
            // otherwise, get rid of it
        } else {
            this.remove(onNote)
        }
    }

    private setSustain(on: boolean): void {
        if (this.isSustainOn === on) return
        this.emit('log', 'debug', `Sustain ${on}`)

        this.isSustainOn = on
        if (on) return

        const sustainedNotes = Array.from(this.activeNotes.values()).filter(
            (an) => an.isSustained
        )
        if (!sustainedNotes.length) return

        sustainedNotes.forEach(this.remove.bind(this))
    }

    private remove(activeNote: ActiveNote) {
        this.activeNotes.delete(activeNote.note)
        this.emit('remove', activeNote)
    }
}
