.PHONY: all bgb clean sloc

all: build/10-print.gb

build/10-print.gb: build/10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

build/%.o: %.asm | build
	rgbasm -E -v -o "$@" "$<"

build:
	mkdir -p "$@/"

bgb: build/10-print.gb
	bgb "$<"

clean:
	rm -rf "build/"

sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
