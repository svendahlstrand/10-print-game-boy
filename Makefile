DMG_VOLUME ?= /Volumes/DMG/

.PHONY: all clean bgb dmg sloc

all: 10-print.gb docs/pretty-source.md

10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

docs/pretty-source.md: 10-print.asm
	tr '\n' '@' < "$<" > "$@"
	sed -i '~' -E 's/@@;/@```@@;/g' "$@"
	sed -i '~' -E 's/;(@[^;])/@```assembly\1/g' "$@"
	sed -i '~' -E $$'s/@/\\\n/g' "$@"
	sed -i '~' -E 's/^; *//g' "$@"

%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

clean:
	rm -f *.{gb,map,o,sym}

bgb: 10-print.gb
	bgb "$<"

dmg: 10-print.gb
	until cp "$<" "$(DMG_VOLUME)" && diskutil unmount "$(DMG_VOLUME)"; do sleep 3; done

sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
