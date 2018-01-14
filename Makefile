# Name of the ROM.
NAME             := 10 PRINT

# Version number of the ROM. Only one byte allowed so no SemVer. :(
VERSION          := 0x01

# Path to SD Card, used by the `sd` target.
SD_CARD_PATH     ?= /Volumes/DMG/

# Current operating system.
OPERATING_SYSTEM := $(shell uname -s)

ifeq ($(OPERATING_SYSTEM), Darwin)
    SED_FLAGS    := -i '' -E
else
    SED_FLAGS    := -i -r
endif

# Phony targets is "recipes" and not the name of a file.
.PHONY: all clean bgb sd sloc

# Build Game Boy ROM and generate annotated source in Markdown format.
all: 10-print.gb 10-pretty.md rom-data.js

# Build Game Boy ROM.
10-print.gb: 10-print.o
	rgblink -d -t -n "$(@:.gb=.sym)" -m "$(@:.gb=.map)" -o "$@" "$<"
	rgbfix -j -p 0x0 -t "$(NAME)" -n "$(VERSION)" -v "$@"

# Assamble object file from source.
%.o: %.asm
	rgbasm -E -v -o "$@" "$<"

# Generate annotated source in Markdown format for easy reading on GitHub.
10-pretty.md: 10-print.asm
	tr '\n' '@' < "$<" > "$@"
	sed $(SED_FLAGS) 's/@@;/@```@@;/g' "$@"
	sed $(SED_FLAGS) 's/;(@[^;])/@```assembly\1/g' "$@"
	tr '@' '\n' < "$@" >> tempfile.md
	mv tempfile.md "$@"
	sed $(SED_FLAGS) 's/^; *//g' "$@"

# Generates a JavaScript array representation of the ROM.
rom-data.js: 10-print.gb
	xxd -i < "$<" | tr -d '\n' > "$@"
	sed $(SED_FLAGS) 's/^[ ]+(.+)$$/var romData = \[\1\];/g' "$@"

# Remove all generated files.
clean:
	rm -f *.gb *.map *.o *.sym *.js "10-pretty.md"

# Start ROM in the BGB Game Boy emulator.
bgb: 10-print.gb
	bgb "$<"

# Copy ROM to SD Card.
sd: 10-print.gb
	until cp "$<" "$(SD_CARD_PATH)" && diskutil unmount "$(SD_CARD_PATH)"; do sleep 3; done

# Count number of source code lines, excluding comments.
sloc: 10-print.asm
	grep -cvE "^;|^$$" "$<"
