import { ActiveNote } from '../MidiInput'
import * as constants from '../constants'
import { activeNotes, CurveParams } from '../midiDudes'

type EnvelopeStage = 'attack' | 'decay' | 'sustain' | 'release' | 'off'
export class EnvelopedNote {
    activeNote: ActiveNote
    stopTime?: number
    stage?: EnvelopeStage
    amplitude?: number
    stageStartAmplitude?: number
    private velocityScale: number = 1

    constructor(midiNote: ActiveNote) {
        this.activeNote = midiNote
        this.calcScale()
    }

    setActiveNote(midiNote: ActiveNote) {
        delete this.stopTime
        this.activeNote = midiNote
        this.calcScale()
    }

    tick(): void {
        const t = Number(process.hrtime.bigint()) / 1e6

        let dt: number
        let endA: number
        let duration: number

        if (this.stopTime) {
            dt = t - this.stopTime
            if (dt >= constants.RELEASE) {
                this.setStage('off')
                this.amplitude = 0
                return
            }
            this.setStage('release')
            endA = 0
            duration = constants.RELEASE
        } else {
            dt = t - this.activeNote.startTime
            if (dt < constants.ATTACK) {
                this.setStage('attack')
                endA = 1
                duration = constants.ATTACK
            } else {
                this.setStage('decay')
                dt -= constants.ATTACK
                if (dt < constants.DECAY) {
                    endA = constants.SUSTAIN
                    duration = constants.DECAY
                } else {
                    this.setStage('sustain')
                    this.amplitude = constants.SUSTAIN
                    return
                }
            }
        }
        this.amplitude = envelope(
            dt,
            this.stageStartAmplitude || 0,
            endA,
            duration,
            constants.ENVELOPE_POWER
        )
    }

    private setStage(stage: EnvelopeStage): void {
        if (this.stage !== stage) {
            this.stage = stage
            this.stageStartAmplitude = this.amplitude
            if (stage === 'off') {
                activeNotes.delete(this.activeNote.note)
            }
        }
    }

    private calcScale(): void {
        this.velocityScale = Math.pow(
            this.activeNote.velocity / constants.VELOCITY_MAX,
            constants.VELOCITY_SCALE_POWER
        )
    }

    public getAmplitude(): number {
        this.tick()
        return ampCurve(this.velocityScale * <number>this.amplitude, {
            sigmoid: 0.6,
            power: 0.6,
        })
    }
}
// produces amplitude curve for different colors, e.g.:
// a = s = p = 1  : f(a) = a
// a = 0.5        : max output is 0.5
// s = 0, p = 1   : regular "S" curve
// s = 2, p = 1   : sideways "S" curve
// s = 1, p = 2   : parabolic curve
// s = 1, p = 0.5 : square root curve (sideways parabolic)
// play with sliders here: https://www.desmos.com/calculator/tybx2m0fwi
const ampCurve = (
    amplitude: number,
    { scale = 1, sigmoid = 1, power = 1 }: CurveParams
) =>
    scale *
    Math.pow(
        sigmoid * amplitude +
            (1 - sigmoid) * (-0.5 * Math.cos(Math.PI * amplitude) + 0.5),
        power
    )
// utility to produce piecewise parabolic decay functions: https://www.desmos.com/calculator/yhpfpbq7gq
const envelope = (
    t: number,
    startA: number,
    endA: number,
    duration: number,
    power: number
): number => (startA - endA) * Math.pow(1 - t / duration, power) + endA
