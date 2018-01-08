.PHONY: all bgb clean sloc

all: 10-print.gb

10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

bgb: 10-print.gb
	bgb "$<"

clean:
	rm -f *.{gb,map,o,sym}

sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
