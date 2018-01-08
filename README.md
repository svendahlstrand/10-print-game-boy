10 PRINT Game Boy
=================

This is a port of the famous 10 PRINT for the Game Boy. Check out the
[README.md][rmd] for the hole backstory.

Constants
---------

```assembly
CHARACTER_DATA EQU $8000
BG_DISPLAY_DATA EQU $9800

LY EQU $FF44
```

 LCD Display Registers
STAT indicates the current status of the LCD controler. There's four modes:

Mode 00: H-Blank, CPU has access to display RAM and OAM.
Mode 01: V-Blank, CPU has access to display RAM and OAM.
Mode 10: LCD controller uses OAM, CPU has access to display RAM.
Mode 11: LCD controller uses display RAM and OAM, CPU has no access.

```assembly
LCD_STATUS           EQU $FF41
```

 LCD controller is busy using OAM and display RAM, CPU has no access.

```assembly
LCD_BUSY             EQU %10
```

 Home section
------------

Before one starts writing any code we must tell the assembler and linker where
it belongs. In RGBDS thats done with the SECTION keyword. A section specifies
a name, that can be anything you want, and a location.

When the Game Boy is turned on an internal program kicks off by scrolling the
logo and some other things. Then it passes control to the user (our) program.

By default the user program starts at address $150 and therefore we put our
section there. Let's call the section Home, that's a name as good as any.

```assembly
SECTION "Home", ROM0[$150]

  call initialize
```

 10 PRINT
--------

```assembly
ten: ; 10
  call put_char ; PRINT
  call random ; RND
  and a, 1 ; we don't care for a full 8 bit value
  jp ten ; GOTO 10
```

 `put_char` subroutine
---------------------

Put character in a to current screen position

```assembly
put_char:
  push de
  push af ; save the character code for later

  ld a, [character_postition]
  ld d, a
  ld a, [character_postition + 1]
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
  ld a, [LY]
  cp 144
  jr nz, .wait_for_v_blank

  pop af ; take the character code back

  ld [de], a

  inc de
  call set_pos
  pop de

  ret
```

 `random` subroutine
-------------------

http://codebase64.org/doku.php?id=base:small_fast_8-bit_prng

```assembly
random:
  ld a, [seed]
  sla a
  jp nc, .no_error
  xor a, $1d
.no_error:
  ld [seed], a

  ret
```

 `initialize` subroutine
-----------------------

```assembly
initialize:
  ld hl, slash
  ld bc, 8 * 8 * 2 * 2 ; Two 8 x 8 charaters, 2 bits per pixel.
  call load_characters

  ld de, BG_DISPLAY_DATA
  call set_pos

  ; set seed
  ld a, 1
  ld [seed], a

  ret
```

 `load_characters` subroutine
----------------------------

Copy BC bytes from HL to DE, assuming destionation is $8000-$9FFF (VRAM) and
thus waits for VRAM to be accessible by the CPU.

Parameters:
HL - address of first tile
BC - number of bytes to copy (number of characters * 8 * 8 * 2)

Registers:
A - used for comparision

```assembly
load_characters:
  ld de, CHARACTER_DATA

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
  jr nz, .wait_for_vram

  ret
```

 `set_pos` subroutine
--------------------

DE - POSITION

```assembly
set_pos:
  push hl

  ld hl, character_postition
  ld [hl], d
  inc hl
  ld [hl], e

  pop hl

  ret
```

 Variables
---------

```assembly
SECTION "Variables", WRAM0

character_postition:
  ds 2
seed:
  ds 1
```

 Character data (tiles)
----------------------

Unlike developing for Commodore C64, developing for Game Boy is bare bones.
We can't take advantage of routines like RND or PRINT and there's no PETCII
glyphs for us to print to the screen. So lets start by creating the graphical
characters we need: \ and / (backslash and slash).

```assembly
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
```

 ROM Registration Data
---------------------

Every Game Boy ROM has section ($100-$14F) where ROM registration data is
stored. It contains information like the title of the software, if it's a
Japanese title and checksums.

For the ROM to work this section has to be present.

```assembly
SECTION "ROM Registration Data", ROM0[$100]
```

 Actully, the first four bytes is not data. It's instructions making a jump to
the user program. By default $150 is allocated as the starting address but
you can change it to whatever you want.

We could write the first four bytes with the `db` keyword:
`db $00, $c3, $50, $01`

But for clarity let's use the mnemonics instead.

```assembly
  nop
  jp $150
```

 We could continue filling out this section by hand but instead we'll use the
tool `rgbfix` once we have assemled and linked our ROM. Speaking of that, it
is time to do just that.

Assembeling the ROM
-------------------

There is three steps to assemble a ROM from a source (`.asm`) file: assembling,
linking and fixing. It's done with the corresponding tools: `rgbasm`, `rgblink`
and `rgbfix`.

[rmd]: ./README.md

