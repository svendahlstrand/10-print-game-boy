; `10 PRINT` Game Boy
; ===================
;
; This program generates a random maze to the Game Boy screen. A port of the
; famous one-liner `10 PRINT CHR$(205.5+RND(1)); : GOTO 10`, originally written
; in BASIC for the Commodore 64 during the early 1980s. For more about that and
; how this project came to be, consult the README.
;
; Some assembly required
; ----------------------
;
; First a word of advice: I'm pretty sure this isn't the best of starting
; points if you are new to assembly language and low-level programming. You
; probably should catch up on the basics before attempting to read this source
; code.
;
; A favorite book of mine and its associated web course has you covered:
; [The Elements of Computing Systems][book] and [NAND2Tetris][n2t]. Another great
; resource is [Easy 6502][e65] - an e-book that shows how to get started with
; 6502 assembly language.
;
; If you feel confident having the skills needed to proceed, make sure you have
; the [Game Boy Programming Manual][gbmanual] and
; [Rednex Game Boy Development System man pages][rgbds] close, for reference.
;
; Down the rabbit hole
; --------------------
;
; Before writing any code, one must tell the assembler and linker where it
; should end up. Using RGBDS, the assembler of my choice, that's done with the
; `SECTION` keyword. A section specifies a name, that can be anything you want,
; and a location.
;
; The first section in this program contains the main loop that generates the
; maze, so naming it wasn't that hard.
;
SECTION "A-MAZE-ING", ROM0

; It's not the BASIC one-liner, but the following lines probably feels familiar,
; am I right?
;
ten:            ; 10      - Not the best label name but makes one feel at home.
  call random   ; RND     - Generates a random 8-bit number in register `a`.
  and a, 1      ;           We don't care for a full 8-bit value though, instead
  inc a         ;           make it 1 or 2 (the character codes for \ and /).

  call print    ; PRINT   - Write the character in register `a` to LCD.

  jp ten        ; GOTO 10 - Wash, rinse, repeat!

; Is that all assembly code we need kick this off? No, unfortunately not. More
; about that in a moment, but first, let's make our lives a little bit easier
; by defining some universal constants.
;
; Constants
; ---------
;
; There's a lot of magic numbers to keep track of when developing for Game Boy.
; We talk to its peripherals through hardware registers (memory mapped IO) and
; using constants, like `LCD_STATUS`, is easier to remember than the specific
; addresses, like `$FF41`.
;
; If this is your first readthrough of the code you can skim this section for
; now and reference it when needed later.
;
; ### Hardware registers
;
LCD_LY          EQU $FF44 ; Indicates current line being sent to LCD controller.
LCD_STATUS      EQU $FF41 ; Holds the current LCD controller status.
LCD_SCY         EQU $FF42

LCD_BUSY        EQU %0010 ; CPU has no access when the LCD controller is busy.

; ### RAM locations
;
CHARACTER_DATA  EQU $8000 ; Area that contains 8 x 8 characters (tiles).
BG_DISPLAY_DATA EQU $9800 ; Area for background display data (character codes).

CHARACTER_SIZE  EQU    16 ; Characters are 8 x 8 x 2 bits per pixel (16 bytes).

; KERNAL
; ------
;
; Developing for Game Boy are more bare bones compared to Commodore 64 that has
; the luxuries of Basic and the KERNAL. There's no `RND` function to call for
; random numbers. No PETSCII font that can be `PRINT`ed to the screen.
;
; For the code under the `A-MAZE-ING` section to work we have to implement the
; necessary subroutines `print` and `random`.
;
; The following section, named KERNAL as a homage to C64, is the actual starting
; point for this program.
;
; When a Game Boy is turned on an internal program kicks off by scrolling the
; logo and some other things. Then it passes control to the user (our) program.
;
; By default, the user program starts at address `$150`, and therefore we put
; the KERNAL section at that location. That way we have the chance to do some
; initialization before passing control over to the A-MAZE-ING section.
;
SECTION "KERNAL", ROM0[$150]

  ld hl, slash                ; Starting from `slash` (/)...
  ld bc, CHARACTER_SIZE * 2   ; ...copy two characters (tiles)...
  ld de, CHARACTER_DATA + $10 ; ...to the character data area...
  call copy_to_vram           ; ...in LCD RAM.

  ld de, BG_DISPLAY_DATA
  call set_cursor             ; Move cursor position to top left of background.

  ld a, $01
  ld [countdown_to_scroll + 1], a
  ld a, $69
  ld [countdown_to_scroll], a

  ; Make sure to clear the background display area to get rid of logotype.
  ld de, BG_DISPLAY_DATA
  ld bc, $400
  ld a, 0
  call fill_vram

  ld a, 42
  ld [seed], a                ; Set the starting seed for the PRNG to 42.

  jp ten                      ; Let the show begin!

; `print` subroutine
; ---------------------
;
; Prints the character in register `a` to the screen. It automatically advances
; `cursor_position` and handles scrolling.
;
; | Registers | Comments                                   |
; | --------- | ------------------------------------------ |
; | `a`       | **parameter** character code to be printed |
;
print:
  push de                         ; Give `de` back to caller later.
  push hl
  push bc
  push af                         ; Save the character code for now.

  ld a, [cursor_position]         ; Load cursor position to `hl`.
  ld l, a
  ld a, [cursor_position + 1]
  ld h, a

.check_if_scroll_needed:
  ld a, [countdown_to_scroll + 1]
  ld d, a
  ld a, [countdown_to_scroll]
  ld e, a

  dec de

  inc e
  dec e ; cp e, 0
  jp nz, .save_countdown
  inc d
  dec d ; cp d, 0
  jp nz, .save_countdown
  ld de, 2 * 20
.scroll_two_rows
  push de
  push hl

  ld d, h
  ld e, l
  ld bc, 2 * 32 ; two full rows
  ld a, 0
  call fill_vram

  pop hl
  pop de

  ld a, [LCD_SCY]
  add a, 16
  ld [LCD_SCY], a
.save_countdown:
  ld a, d
  ld [countdown_to_scroll + 1], a
  ld a, e
  ld [countdown_to_scroll], a

.wait_for_v_blank:
  ld a, [LCD_LY]
  cp 144
  jr nz, .wait_for_v_blank

  pop af                          ; Take the character code back from stack...
  ld [hl+], a                      ; ...and print it to the screen.

  ld d, h
  ld e, l
  call set_cursor                 ; Advance the cursor one step.

  pop bc
  pop hl
  pop de                          ; Give the back to the caller.

  ret

; `random` subroutine
; -------------------
;
; Returns a random 8-bit number in register `a`.
;
; | Registers | Comments                         |
; | --------- | -------------------------------- |
; | `a`       | **returned** random 8-bit number |
;
random:
  ld a, [seed]
  sla a
  jp nc, .no_error
  xor a, $1d
.no_error:
  ld [seed], a

  ret

; `fill_vram` subroutine
; ----------------------------
;
; Write `bc` bytes of `a` starting at `de`, assuming destination is
; `$8000-$9FFF` and thus waits for VRAM to be accessible by the CPU.
;
; | Registers | Comments                              |
; | --------- | ------------------------------------- |
; | `de`      | **parameter** starting address        |
; | `bc`      | **parameter** number of bytes to copy |
; | `a`       | **parameter** value to write          |
; | `hl`      | **scratched** used for adressing      |
;
fill_vram:
.wait_for_vram:
  ld a, [LCD_STATUS]
  and LCD_BUSY
  jr nz, .wait_for_vram

  ld [de], a
  ld h, d
  ld l, e
  inc de
  dec bc

; `copy_to_vram` subroutine
; ----------------------------
;
; Copy `bc` bytes from `hl` to `de`, assuming destination is `$8000-$9FFF` and
; thus waits for VRAM to be accessible by the CPU.
;
; | Registers | Comments                              |
; | --------- | ------------------------------------- |
; | `hl`      | **parameter** source address          |
; | `de`      | **parameter** destination address     |
; | `bc`      | **parameter** number of bytes to copy |
; | `a`       | **scratched** used for comparison     |
;
copy_to_vram:
.wait_for_vram:
  ld a, [LCD_STATUS]
  and LCD_BUSY
  jr nz, .wait_for_vram

  ld a, [hl+]
  ld [de], a
  inc de

  dec bc
  ld a, c
  or b
  jr nz, copy_to_vram

  ret

; `set_cursor` subroutine
; --------------------
;
; Set cursor position, the location of the next character that's going to be
; written to LCD using `print`.
;
; | Registers | Comments                                                |
; | --------- | --------------------------------------------------------|
; | `de`      | **parameter** cursor position within background display |
;
set_cursor:
  push af
  push hl

  ld a, $14                       ; We are gooing to loop from $14 to $F4...
.check_for_screen_edge:           ; ...checking if cursor is on screen edge...
  cp a, e
  jr z, .move_cursor_to_next_line ; ...and in that case move it to next line.
  cp a, $F4
  jr z, .save_position          ; End the loop if finished...
  add a, $20                      ; ...else increment...
  jp .check_for_screen_edge       ; ...and loop.

.move_cursor_to_next_line:
  add a, $B
  ld e, a
  inc de

.check_for_reset:
  ld a, $9C
  cp a, d
  jp nz, .save_position
  ld a, $00
  cp a, e
  jp nz, .save_position
  ld de, BG_DISPLAY_DATA

.save_position:
  ld hl, cursor_position

  ld [hl], e
  inc hl
  ld [hl], d

.end:
  pop hl
  pop af

  ret

; Variables
; ---------
;
SECTION "Variables", WRAM0

cursor_position:
  ds 2
countdown_to_scroll:
  ds 2
seed:
  ds 1

; Character data (tiles)
; ----------------------
;
; Unlike developing for Commodore C64, developing for Game Boy is bare bones.
; We can't take advantage of routines like RND or PRINT, and there are no PETCII
; glyphs for us to print to the screen. So let's start by creating the graphical
; characters we need: \ and / (backslash and slash).
;
SECTION "Character data (tiles)", ROM0

slash:
  dw `00000011
  dw `00000111
  dw `00001110
  dw `00011100
  dw `00111000
  dw `01110000
  dw `11100000
  dw `11000000

backslash:
  dw `11000000
  dw `11100000
  dw `01110000
  dw `00111000
  dw `00011100
  dw `00001110
  dw `00000111
  dw `00000011

; ROM Registration Data
; ---------------------
;
; Every Game Boy ROM has a section (`$100-$14F`) where ROM registration data is
; stored. It contains information about the title of the software, if it's a
; Japanese title, and more.
;
; For the ROM to work this section has to be present.
;
SECTION "ROM Registration Data", ROM0[$100]

; The first four bytes are not data. It's instructions making a jump to the user
; program. By default `$150` is allocated as the starting address, but you can
; change it to whatever you want.
;
; We could write the first four bytes with the `db` keyword:
; `db $00, $c3, $50, $01`
;
; But for clarity let's use the mnemonics instead.
;
  nop
  jp $150

; We could continue filling out this section by hand, but instead, we'll use the
; tool `rgbfix` once we have assembled and linked our ROM.
;
; [n2t]: http://nand2tetris.org
; [book]: http://nand2tetris.org/book.php
; [gbmanual]: https://ia801906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
; [rgbds]: https://www.mankier.com/7/rgbds
; [e65]: https://skilldrick.github.io/easy6502/
