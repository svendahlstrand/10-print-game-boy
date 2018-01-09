`10 PRINT` Game Boy
===================

`10 PRINT CHR$(205.5+RND(1)); : GOTO 10` is an elegant and concise single line
of code, written in BASIC for the Commodore 64 sometime in the early 1980s.

When run, it produces a maze-like pattern on the screen in an endless loop.

This is my interpretation, my port, of that one-liner. Written in assembly
language, using the RGBDS toolchain, for the original Game Boy.

![](./docs/10-print.gif)

> `10 PRINT` running on Commodore 64 (left) and Game Boy (right).

How comes is that?
------------------

In early 2018 I read the book [10 PRINT CHR$(205.5+RND(1)); : GOTO 10][10]. Yes,
that's the name of the book, and yes, it has 328 pages, dedicated to that
lovely, three decades old, single line of BASIC code.

Around that same time, I had been on a long trip down memory lane, being
nostalgic about, and developing for my first handheld console love: Game Boy.

Porting `10 PRINT` felt like a fun and achievable challenge. Not trivial,
though, as the Game Boy lacks some of the luxuries the Commodore 64 provides
through its kernal (operating system) and BASIC.

Try me!
-------

You, yes you, should take this little gem for a spin. Why not check out the
[pretty, annotated version of the source code][src] or [download the ROM][rom]
for a test drive in your favorite Game Boy emulator.

Assembling the ROM
------------------

There are three steps to assemble a ROM from a source (`.asm`) file:
assembling, linking and fixing. It's done with the corresponding tools:
`rgbasm`, `rgblink`, and `rgbfix`.

[n2t]: http://nand2tetris.org
[book]: http://nand2tetris.org/book.php
[gbmanual]: https://ia801906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
[rgbds]: https://www.mankier.com/7/rgbds
[e65]: https://skilldrick.github.io/easy6502/
[src]: ./docs/pretty-source.md
[rom]: ./na.gb
[10]: http://10print.org

