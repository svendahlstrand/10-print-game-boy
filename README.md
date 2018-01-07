# 10 PRINT Game Boy

Before one starts writing any code we must tell the assembler and linker where
it belongs. In RGBDS thats done with the SECTION keyword. A section specifies
a name, that can be anything you want, and a location.

When the Game Boy is turned on an internal program kicks off by scrolling the
logo and some other things. Then it passes control to the user (our) program.

By default the user program starts at address $150 and therefore we put our
section there. Let's call the section Main, that's a name as good as any.

```asm
SECTION "Main", ROM0[$150]
  nop
  halt
```

Every Game Boy ROM has section ($100-$14F) where ROM registration data is
stored. It contains information like the title of the software, if it's a
Japanese title and checksums.

For the ROM to work this section has to be present.
```asm
SECTION "ROM Registration Data", ROM0[$100]
```

Actully, the first four bytes is not data. It's instructions making a jump to
the user program. By default $150 is allocated as the starting address but
you can change it to whatever you want.

We could write the first four bytes with the `db` keyword:
`db $00, $c3, $50, $01`

But for clarity let's use the mnemonics instead.
  nop
  jp $150

We could continue filling out this section by hand but instead we'll use the
tool `rgbfix` once we have assemled and linked our ROM.

