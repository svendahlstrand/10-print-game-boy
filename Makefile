.PHONY: all clean bgb sloc

all: 10-print.gb

10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

clean:
	rm -f *.{gb,map,o,sym}

bgb: 10-print.gb
	bgb "$<"

sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
