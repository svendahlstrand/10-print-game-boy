; `10 PRINT` Game Boy
; ===================
;
; `10 PRINT CHR$(205.5+RND(1)); : GOTO 10` is an elegant and concise single line
; of code, written in BASIC for the Commodore 64 sometime in the early 1980s.
;
; When run, it produces a maze-like pattern on the screen in an endless loop.
;
; This is my interpretation, my port, of that one-liner. Written in assembly
; language, using the RGBDS toolchain, for the original Game Boy.
;
; ![](10-print.gif)
;
; > `10 PRINT` running on Commodore 64 (left) and Game Boy (right).
;
; How comes is that?
; ------------------
;
; Early 2018 I read the book 10 *PRINT CHR$(205.5+RND(1)); : GOTO 10*. Yes,
; that's the name of the book, and yes, it has 328 pages, dedicated to this
; three decades old, single line of BASIC code.
;
; Around that time, I've also was a long trip down memory lane, being nostalgic
; about, and developing for my first video game console love: Game Boy.
;
; Porting `10 PRINT` felt like a fun and achiviable challange. Not trivial,
; though, as the Game Boy lacks some of the luxuries the Commodore 64 provides
; through its kernal (operating system) and BASIC.
;
; So, onward and forward!
;
; Some assembly required
; ----------------------
;
; Are you new to assembly language and low-level programming? Then you probably
; want to catch up on some concepts before attempting to read this source code.
;
; There are a great book and associated web course that has you covered:
; [The Elements of Computing Systems][book] and [NAND2Tetris][n2t]. Another
; resource is [Easy 6502][e65] - an e-book that shows how to get started with
; 6502 assembly language.
;
; You should also have the [Game Boy Programming Manual][gbmanual] and the
; [Rednex Game Boy Development System man pages][rgbds] at hand, for reference.
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
  add a, 1      ;           make it 1 or 2 (the character codes for \ and /).

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
; using a constant like `LCD_STATUS` is easier than having to remember the
; specific address `$FF41`.
;
; If this is your first readthrough of the code you can skim this section for
; now and reference it when needed.
;
; ### Hardware registers
;
LCD_LY          EQU $FF44 ; Indicates current line being sent to LCD controller.
LCD_STATUS      EQU $FF41 ; Holds the current LCD controller status.

LCD_BUSY        EQU %0010 ; CPU has no access when the LCD controller is busy.

; ### RAM locations
;
CHARACTER_DATA  EQU $8000 ; Area that contains 8 x 8 characters (tiles).
BG_DISPLAY_DATA EQU $9800 ; Area for background display data (character codes).

CHARACTER_SIZE  EQU 8 * 8 * 2

; Kernal
; ------
;
; Developing for Game Boy are more bare bones compared to Commodore 64 that has
; the luxuries of Basic and the kernal. There's no `RND` function to call for
; random numbers. No PETSCII font that can be `PRINT`ed to the screen.
;
; For the code under the `A-MASE-ING` section to work we have to implement the
; necessary subroutines `print` and `random`.
;
; The following section, named Kernal as a homage to C64, is the actual starting
; point for this program.
;
; When a Game Boy is turned on an internal program kicks off by scrolling the
; logo and some other things. Then it passes control to the user (our) program.
;
; By default, the user program starts at address `$150`, and therefore we put
; the Kernal section at that location. That way we have the chance to do some
; initialization before passing control over to the A-MAZE-ING section.
;
SECTION "Kernal", ROM0[$150]

  ld hl, slash                ; Starting from `slash` (/)...
  ld bc, CHARACTER_SIZE * 2   ; ...copy two 8 x 8 charaters, 2 bits per pixel...
  ld de, CHARACTER_DATA + $10 ; ...to the character data area...
  call copy_to_vram           ; ...in LCD RAM.

  ld de, BG_DISPLAY_DATA
  call set_cursor             ; Move cursor position to top left of background.

  ld a, 42
  ld [seed], a                ; Set the starting seed for the PRNG to 42.

  jp ten                      ; Let the show begin!

; `print` subroutine
; ---------------------
;
; Writes the character in register `a` to the screen. It automatically advances
; `cursor_position` and handles scrolling.
;
print:
  push de
  push af ; save the character code for later

  ld a, [cursor_position]
  ld d, a
  ld a, [cursor_position + 1]
  ld e, a

  ld a, $F4

.check_for_new_row:
  add a, $20
  cp a, e
  jr z, .new_row
  cp a, $F4
  jr nz, .check_for_new_row
  jp .put_char_to_lcd

.new_row:
  add a, $b
  ld e, a
  inc de

.check_for_reset:
  ld a, $9a
  cp a, d
  jp nz, .put_char_to_lcd
  ld a, $40
  cp a, e
  jp nz, .put_char_to_lcd
  ld de, BG_DISPLAY_DATA

.put_char_to_lcd:
.wait_for_v_blank:
  ld a, [LCD_LY]
  cp 144
  jr nz, .wait_for_v_blank

  pop af ; take the character code back

  ld [de], a

  inc de
  call set_cursor
  pop de

  ret

; `random` subroutine
; -------------------
;
; Returns a random 8-bit number in register `a`.
;
; http://codebase64.org/doku.php?id=base:small_fast_8-bit_prng
;
random:
  ld a, [seed]
  sla a
  jp nc, .no_error
  xor a, $1d
.no_error:
  ld [seed], a

  ret

; `copy_to_vram` subroutine
; ----------------------------
;
; Copy `bc` bytes from `hl` to `de`, assuming destination is `$8000-$9FFF` and
; thus waits for VRAM to be accessible by the CPU.
;
; | Registers | Comments                                                                 |
; | --------- | ------------------------------------------------------------------------ |
; | `hl`      | **parameter** source address                                             |
; | `de`      | **parameter** destination address                                        |
; | `bc`      | **parameter** number of bytes to copy                                    |
; | `a`       | used for comparison                                                      |
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
; | Registers | Comments                                                   |
; | --------- | ---------------------------------------------------------- |
; | `de`      | **parameter** cursor position within background display    |
;
set_cursor:
  push hl

  ld hl, cursor_position
  ld [hl], d
  inc hl
  ld [hl], e

  pop hl

  ret

; Variables
; ---------
;
SECTION "Variables", WRAM0

cursor_position:
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
; Assembling the ROM
; ------------------
;
; There are three steps to assemble a ROM from a source (`.asm`) file:
; assembling, linking and fixing. It's done with the corresponding tools:
; `rgbasm`, `rgblink`, and `rgbfix`.
;
; [n2t]: http://nand2tetris.org
; [book]: http://nand2tetris.org/book.php
; [gbmanual]: https://ia801906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
; [rgbds]: https://www.mankier.com/7/rgbds
; [e65]: https://skilldrick.github.io/easy6502/
