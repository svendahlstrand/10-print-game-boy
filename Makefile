.PHONY: all clean bgb sloc

all: 10-print.gb README.md

10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

clean:
	rm -f *.{gb,map,o,sym,md}

bgb: 10-print.gb
	bgb "$<"

sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"

README.md: 10-print.asm
	tr '\n' '@' < "$<" > "$@"
	sed -i '' -E 's/@@;/@```@@/g' "$@"
	sed -i '' -E 's/;(@[^;])/@```assembly\1/g' "$@"
	sed -i '' -E $$'s/@/\\\n/g' "$@"
	sed -i '' -E 's/^; *//g' "$@"
