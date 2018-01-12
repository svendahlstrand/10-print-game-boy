# Path to SD Card, used by the `sd` target.
SD_CARD_PATH ?= /Volumes/DMG/

# Phony targets is "recipes" and not the name of a file.
.PHONY: all clean bgb sd sloc

# Build Game Boy ROM.
10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "10 PRINT" -v "$@"

# Assamble object file from source.
%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

# Generate annotated source in Markdown format for easy reading on GitHub.
docs/pretty-source.md: 10-print.asm
	tr '\n' '@' < "$<" > "$@"
	sed -i '~' -E 's/@@;/@```@@;/g' "$@"
	sed -i '~' -E 's/;(@[^;])/@```assembly\1/g' "$@"
	sed -i '~' -E $$'s/@/\\\n/g' "$@"
	sed -i '~' -E 's/^; *//g' "$@"

# Build Game Boy ROM and generate annotated source in Markdown format.
all: 10-print.gb docs/pretty-source.md

# Remove all generated files.
clean:
	rm -f *.gb *.map *.o *.sym

# Start ROM in the BGB Game Boy emulator.
bgb: 10-print.gb
	bgb "$<"

# Copy ROM to SD Card.
sd: 10-print.gb
	until cp "$<" "$(SD_CARD_PATH)" && diskutil unmount "$(SD_CARD_PATH)"; do sleep 3; done

# Count number of source code lines, excluding comments.
sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
