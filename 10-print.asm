; `10 PRINT` Game Boy
; ===================
;
; This program generates a random maze to the Game Boy screen. A port of the
; famous one-liner `10 PRINT CHR$(205.5+RND(1)); : GOTO 10`, originally written
; in BASIC for the Commodore 64 during the early 1980s. For more about that and
; how this project came to be, consult the [README][readme].
;
; Two good companions
; -------------------
;
; There's a good idea to have the [Game Boy Programming Manual][gbmanual] and
; [Rednex Game Boy Development System man pages][rgbds] at hand, for reference,
; while studying this source.
;
; Main loop
; ---------
;
; Before writing any code, one must tell the assembler and linker where the
; instructions and data should end up. Using RGBDS, the assembler of my choice,
; that's done with the `SECTION` keyword. A section specifies a name that can
; be anything you want, and a location, like ROM or WRAM.
;
; The first section in this program contains the main loop that generates the
; maze. Let's give it a name and place it in `ROM0`, starting at memory address
; `$0000`.
;
SECTION "10 PRINT", ROM0

; It's not a compact one-liner, like the BASIC version, but the instructions on
; the following lines may feel somewhat familiar.
;
ten:            ; 10      - Not the best label name but makes one feel at home.
  call random   ; RND     - Subroutine puts a random number in register `a`.
  and a, 1      ;           We don't care for a full 8-bit value though, instead
  inc a         ; CHR$      make it 1 or 2 (the character codes for \ and /).

  call print    ; PRINT   - Prints the character in register `a` to LCD.

  jp ten        ; GOTO 10 - Wash, rinse, repeat!

; Is that all assembly code we need kick this off? Yes and no. The heavy lifting
; is done by the two subroutines, `random` and `print`, and they are not
; implemented yet. More about them in a moment, but first, let's make our lives
; a more comfortable by defining some universal constants.
;
; Constants
; ---------
;
; There's a lot of magic numbers to keep track of when developing for Game Boy.
; We talk to its peripherals through hardware registers (memory mapped IO) and
; sprinkle numbers with special meaning around the source.
;
; Using constants, like `LCD_STATUS`, is easier to remember than specific
; addresses or values, like `$FF41` or `%11100100`.
;
; ### Memory map
;
CHARACTER_DATA      EQU $8000     ; Area for 8 x 8 characters (tiles).
BG_DISPLAY_DATA     EQU $9800     ; Area for background display data (tilemap).

SOUND_CONTROL       EQU $FF26     ; Sound circuits status and control.

LCD_STATUS          EQU $FF41     ; Holds the current LCD controller status.
LCD_SCROLL_Y        EQU $FF42     ; Vertical scroll position for background.
LCD_Y_COORDINATE    EQU $FF44     ; Current line being sent to LCD controller.
LCD_BG_PALETTE      EQU $FF47     ; Palette data for background.

; ### Magic values
;
CHARACTER_SIZE      EQU 16        ; 8 x 8 and 2 bits per pixel (16 bytes).

LCD_BUSY            EQU %00000010 ; LCD controller is busy, CPU has no access.
LCD_DEFAULT_PALETTE EQU %11100100 ; Default grayscale palette.

; KERNAL
; ------
;
; Developing for Game Boy are more bare bones compared to Commodore 64, that
; enjoys the luxuries of BASIC and the KERNAL. There's no `RND` function to call
; for random numbers and no PETSCII font that can be `PRINT`ed to the screen.
;
; For the code under the `10 PRINT` section to work we have to implement the
; necessary subroutines `print` and `random`.
;
; The following section, named KERNAL as a homage to C64, is the actual starting
; point for this program. When a Game Boy is turned on an internal program kicks
; off by scrolling the Nintendo logo and setting some initial state. Then
; control is passed over to the user program, starting at memory address `$150`
; by default.
;
SECTION "KERNAL", ROM0[$150]

; The original KERNAL is the Commodore 64's operating system. This little demo
; won't need a complete operating system, but we will have to implement some of
; the low-level subroutines.
;
; But first things first. This is where user program starts so let us begin with
; some initialization before passing control over to the `10 PRINT` section.
;
  ; Set default grayscale palette.
  ld a, LCD_DEFAULT_PALETTE
  ld [LCD_BG_PALETTE], a

  ; Disable all sound circuits to save battery.
  ld hl, SOUND_CONTROL
  res 7, [hl]

  ; Copy two characters (tiles) worth of data from ROM to character data area in
  ; LCD RAM. Keep the first character in RAM empty, though, by using offset
  ; `$10`.
  ld hl, slash
  ld bc, CHARACTER_SIZE * 2
  ld de, CHARACTER_DATA + $10
  call copy_to_vram

  ; Set cursor position to top left of background.
  ld de, BG_DISPLAY_DATA
  call set_cursor

  ; Initialize the scroll counter.
  ld a, $01
  ld [countdown_to_scroll + 1], a
  ld a, $69
  ld [countdown_to_scroll], a

  ; Clear background display area of the logotype.
  ld de, BG_DISPLAY_DATA
  ld bc, $400
  ld a, 0
  call fill_vram

  ; Set starting seed for the pseudo-random number generator to 42.
  ld a, 42
  ld [seed], a

  ; Let the show begin!
  jp ten

; ### `print` subroutine
;
; Prints the character in the register `a` to the screen. It automatically
; advances `cursor_position` and handles scrolling.
;
; | Registers | Comments                                   |
; | --------- | ------------------------------------------ |
; | `a`       | **parameter** character code to be printed |
;
print:
  push de
  push hl
  push bc
  push af

  ld a, [cursor_position]
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

  ld a, [LCD_SCROLL_Y]
  add a, 16
  ld [LCD_SCROLL_Y], a
.save_countdown:
  ld a, d
  ld [countdown_to_scroll + 1], a
  ld a, e
  ld [countdown_to_scroll], a

.wait_for_v_blank:
  ld a, [LCD_Y_COORDINATE]
  cp 144
  jr nz, .wait_for_v_blank

  ; Take the character code back from the stack and print it to the screen.
  ; Advance the cursor one step.
  pop af
  ld [hl+], a
  ld d, h
  ld e, l
  call set_cursor

  pop bc
  pop hl
  pop de

  ret

; ### `random` subroutine
;
; Returns a random 8-bit number in the register `a`.
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

; ### `fill_vram` subroutine
;
; Write `bc` bytes of `a` starting at `de`, assuming destination is
; `$8000-$9FFF` and thus waits for VRAM to be accessible by the CPU.
;
; | Registers | Comments                              |
; | --------- | ------------------------------------- |
; | `de`      | **parameter** starting address        |
; | `bc`      | **parameter** number of bytes to copy |
; | `a`       | **parameter** value to write          |
; | `hl`      | **scratched** used for addressing     |
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

; ### `copy_to_vram` subroutine
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

; ### `set_cursor` subroutine
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
  jr z, .save_position            ; End the loop if finished...
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

; ### Variables
;
; The KERNAL makes use of variables, and this section allocates memory for them.
;
SECTION "Variables", WRAM0

cursor_position:
  ds 2
countdown_to_scroll:
  ds 2
seed:
  ds 1

; ### Character data (tiles)
;
; Here are the actual graphical characters (tiles) that will be printed to
; screen: backslash and slash. With the current palette `0` represents white
; and `3` represents black. The Game Boy is capable of showing four different
; shades of grey. Or is it green?
;
SECTION "Character data (tiles)", ROM0

slash:
  dw `00000033
  dw `00000333
  dw `00003330
  dw `00033300
  dw `00333000
  dw `03330000
  dw `33300000
  dw `33000000

backslash:
  dw `33000000
  dw `33300000
  dw `03330000
  dw `00333000
  dw `00033300
  dw `00003330
  dw `00000333
  dw `00000033

; ROM Registration Data
; ---------------------
;
; Every Game Boy ROM has a section (`$100-$14F`) where ROM registration data is
; stored. It contains information about the ROM, like the name of the game, if
; it's a Japanese release and more.
;
; For the ROM to boot correctly, this section has to be present.
;
SECTION "ROM Registration Data", ROM0[$100]

; The first four bytes are not data but instructions, making a jump to the user
; program. By default `$150` is allocated as the starting address, but you can
; change it to whatever you want.
;
; We could write the first four bytes with the `db` keyword:
; `db $00, $c3, $50, $01`
;
; But, for clarity, let's use the mnemonics instead.
;
  nop
  jp $150

; Instead of filling out this whole section by hand we'll use the tool `rgbfix`
; once we [assemble and link the ROM][asm].
;
; [gbmanual]: https://ia801906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
; [rgbds]: https://www.mankier.com/7/rgbds
; [readme]: ./README.md
; [asm]: ./README.md#assemble-using-rgbds
