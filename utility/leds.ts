import * as constants from '../constants'
import { Rgb } from './color'

export interface NoteColor {
    rgb: Rgb
    ledIndex: number
}

export const antialias = (ledIndex: number, noteColor: NoteColor): Rgb =>
    <Rgb>(
        noteColor.rgb.map(
            (value) =>
                value *
                (1 -
                    Math.abs(noteColor.ledIndex - ledIndex) /
                        constants.LED_NOTE_WIDTH)
        )
    )
