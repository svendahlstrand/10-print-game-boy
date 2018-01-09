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

Porting `10 PRINT` to Game Boy felt like a fun and achievable challenge. Not
trivial, though, as the Game Boy lacks some of the luxuries the Commodore 64
provides through its kernal (operating system) and BASIC.

Try me!
-------

There's a handful of ways you can interact with this port of mine. Maybe you
want to study the [annotated source code][src] and [assemble it yourself][asm].

If that's not your thing, take the preassembled [ROM][rom] for a spin in your
favorite Game Boy emulator or [run it in the browser][browser].

Assembling the ROM
------------------

There are three steps to assemble a ROM from a source (`.asm`) file: assembling,
linking and fixing. It's done with the corresponding tools `rgbasm`, `rgblink`,
and `rgbfix` that's part of the RGBDS package, make sure to install
[RGBDS][rgbds] on your system.

If you want all the details and assemble manually, open up the [Makefile][make]
for inspiration.

If not, just run `make` and the assembled file *10-print.gb* should show up. You
need to be on a \*nixy system, like macOS or GNU/Linux, with RGBDS and make
installed for that to work.

[n2t]: http://nand2tetris.org
[book]: http://nand2tetris.org/book.php
[gbmanual]: https://ia801906.us.archive.org/19/items/GameBoyProgManVer1.1/GameBoyProgManVer1.1.pdf
[rgbds]: https://www.mankier.com/7/rgbds
[e65]: https://skilldrick.github.io/easy6502/
[src]: ./docs/pretty-source.md
[rom]: ./na.gb
[10]: http://10print.org
[asm]: #assembling-the-rom
[browser]: #not-available
[make]: ./Makefile
