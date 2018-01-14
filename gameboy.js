// The MIT License (MIT)
//
// Copyright (c) 2016 Diego Acosta
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Gameboy = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var debug = require('debug')('gameboy:cpu');
var cycle = require('debug')('gameboy:cpu:cycle');
var int = require('debug')('gameboy:cpu:int');
var raf = require('raf');
var opcodes = require('./opcodes');
var Serializable = require('../util/serializable');

var _require = require('../interrupts'),
    INT_40 = _require.INT_40,
    INT_48 = _require.INT_48,
    INT_50 = _require.INT_50,
    INT_58 = _require.INT_58,
    INT_60 = _require.INT_60;

var exclude = ['_mmu', '_timer', '_lcd', '_loop'];

var Cpu = function (_Serializable) {
    _inherits(Cpu, _Serializable);

    function Cpu(mmu, timer, lcd) {
        _classCallCheck(this, Cpu);

        var _this = _possibleConstructorReturn(this, (Cpu.__proto__ || Object.getPrototypeOf(Cpu)).call(this));

        _this._mmu = mmu;
        _this._timer = timer;
        _this._lcd = lcd;

        // Gameloop

        _this._loop = null;

        // Interrupt Master Enable

        _this.ime = false;

        // 8-bit registers

        _this._a = 0;_this._f = 0;
        _this._b = 0;_this._c = 0;
        _this._d = 0;_this._e = 0;
        _this._h = 0;_this._l = 0;

        // 16-bit registers

        _this._sp = 0;
        _this._pc = 0;
        return _this;
    }

    // 8-bit registers

    _createClass(Cpu, [{
        key: 'init',
        value: function init() {
            this.ime = false;

            this._a = 0;this._f = 0;
            this._b = 0;this._c = 0;
            this._d = 0;this._e = 0;
            this._h = 0;this._l = 0;

            this._sp = 0;
            this._pc = 0;
        }
    }, {
        key: 'start',
        value: function start() {
            var _this2 = this;

            debug('start');

            var tick = function tick() {
                _this2._step();
                _this2._loop = raf(tick);
            };
            this._loop = raf(tick);
        }
    }, {
        key: 'stop',
        value: function stop() {
            debug('stop');
            raf.cancel(this._loop);
        }
    }, {
        key: '_step',
        value: function _step() {
            var frameCycles = 0;
            var t = 0;

            while (frameCycles < 70224) {
                var cycles = this._runCycle() + t;
                this._timer.step(cycles);
                this._lcd.step(cycles);
                t = this._handleInterrupts();
                frameCycles += cycles;
            }
        }
    }, {
        key: '_runCycle',
        value: function _runCycle() {
            var opcode = this._mmu.readByte(this._pc);
            var insts = opcodes.$;

            if (opcode == 0xcb) {
                opcode = this._mmu.readByte(this._pc + 1);
                insts = opcodes.$[0xcb];
            }

            var _insts$opcode = _slicedToArray(insts[opcode], 2),
                mnemonic = _insts$opcode[0],
                fn = _insts$opcode[1];

            cycle('%s; $%s', mnemonic, this._pc.toString(16));
            return fn(this, this._mmu);
        }
    }, {
        key: '_handleInterrupts',
        value: function _handleInterrupts() {
            /**
             * IME - Interrupt Master Enable Flag (Write Only)
             *
             * 0 - Disable all Interrupts
             * 1 - Enable all Interrupts that are enabled in IE Register (FFFF)
             */
            if (!this.ime) return 0;

            var flags = this._mmu.ie & this._mmu.if;
            if (flags == 0) return 0;

            int('flags 0b%s', flags.toString(2));

            var addr = void 0;
            if (flags & INT_40) {
                this._mmu.if &= ~INT_40;addr = 0x40;
            } else if (flags & INT_48) {
                this._mmu.if &= ~INT_48;addr = 0x48;
            } else if (flags & INT_50) {
                this._mmu.if &= ~INT_50;addr = 0x50;
            } else if (flags & INT_58) {
                this._mmu.if &= ~INT_58;addr = 0x58;
            } else if (flags & INT_60) {
                this._mmu.if &= ~INT_60;addr = 0x60;
            }

            this.ime = false;

            this._mmu.writeWord(this._sp -= 2, this._pc);
            this._pc = addr;

            return 16;
        }
    }, {
        key: 'a',
        get: function get() {
            return this._a;
        },
        set: function set(v) {
            this._a = v & 0xff;
        }
    }, {
        key: 'f',
        get: function get() {
            return this._f;
        },
        set: function set(v) {
            this._f = v & 0xf0;
        }
    }, {
        key: 'b',
        get: function get() {
            return this._b;
        },
        set: function set(v) {
            this._b = v & 0xff;
        }
    }, {
        key: 'c',
        get: function get() {
            return this._c;
        },
        set: function set(v) {
            this._c = v & 0xff;
        }
    }, {
        key: 'd',
        get: function get() {
            return this._d;
        },
        set: function set(v) {
            this._d = v & 0xff;
        }
    }, {
        key: 'e',
        get: function get() {
            return this._e;
        },
        set: function set(v) {
            this._e = v & 0xff;
        }
    }, {
        key: 'h',
        get: function get() {
            return this._h;
        },
        set: function set(v) {
            this._h = v & 0xff;
        }
    }, {
        key: 'l',
        get: function get() {
            return this._l;
        },
        set: function set(v) {
            this._l = v & 0xff;
        }

        // Paired 8-bit registers

    }, {
        key: 'af',
        get: function get() {
            return this._a << 8 | this._f;
        },
        set: function set(v) {
            this.a = v >> 8;this.f = v;
        }
    }, {
        key: 'bc',
        get: function get() {
            return this._b << 8 | this._c;
        },
        set: function set(v) {
            this.b = v >> 8;this.c = v;
        }
    }, {
        key: 'de',
        get: function get() {
            return this._d << 8 | this._e;
        },
        set: function set(v) {
            this.d = v >> 8;this.e = v;
        }
    }, {
        key: 'hl',
        get: function get() {
            return this._h << 8 | this._l;
        },
        set: function set(v) {
            this.h = v >> 8;this.l = v;
        }

        // 16-bit registers

    }, {
        key: 'sp',
        get: function get() {
            return this._sp;
        },
        set: function set(v) {
            this._sp = v & 0xffff;
        }
    }, {
        key: 'pc',
        get: function get() {
            return this._pc;
        },
        set: function set(v) {
            this._pc = v & 0xffff;
        }
    }]);

    return Cpu;
}(Serializable({ exclude: exclude }));

module.exports = Cpu;

},{"../interrupts":8,"../util/serializable":16,"./opcodes":2,"debug":14,"raf":21}],2:[function(require,module,exports){
'use strict';

require('../util/number');

var unknown = function unknown() {
    var prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return function (cpu, mmu) {
        var opcode = mmu.readByte(cpu.pc);

        var value = '' + prefix.toString(16) + opcode.toString(16);
        var addr = cpu.pc.toString(16);
        throw new Error('unknown opcode 0x' + value + '; $' + addr);
    };
};

var $ = exports.$ = new Array(0xff).fill([null, unknown()]);
var $cb = $[0xcb] = new Array(0xff).fill([null, unknown(0xcb)]);

/**
 * The Flag Register (lower 8bit of AF register)
 *
 * Bit  Name  Set Clr  Expl.
 * 7    zf    Z   NZ   Zero Flag
 * 6    n     -   -    Add/Sub-Flag (BCD)
 * 5    h     -   -    Half Carry Flag (BCD)
 * 4    cy    C   NC   Carry Flag
 * 3-0  -     -   -    Not used (always zero)
 */

var FLAG_Z = 0x80;
var FLAG_N = 0x40;
var FLAG_H = 0x20;
var FLAG_C = 0x10;

// 8-Bit Loads

/**
 * LD nn,n
 *
 * Description:
 * Put value nn into n.
 *
 * Use with:
 * nn = B, C, D, E, H, L, BC, DE, HL, SP
 * n = 8 bit immediate value
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             B,n           06        8
 * LD             C,n           0E        8
 * LD             D,n           16        8
 * LD             E,n           1E        8
 * LD             H,n           26        8
 * LD             L,n           2E        8
 */

var LD_nn_n = function LD_nn_n(nn) {
    return function (cpu, mmu) {
        cpu[nn] = mmu.readByte(cpu.pc + 1);
        cpu.pc += 2;

        return 8;
    };
};

$[0x06] = ['LD B,n', LD_nn_n('b')];
$[0x0e] = ['LD C,n', LD_nn_n('c')];
$[0x16] = ['LD D,n', LD_nn_n('d')];
$[0x1e] = ['LD E,n', LD_nn_n('e')];
$[0x26] = ['LD H,n', LD_nn_n('h')];
$[0x2e] = ['LD L,n', LD_nn_n('l')];

/**
 * LD r1,r2
 *
 * Description:
 * Put value r2 into r1.
 *
 * Use with:
 * r1,r2 = A, B, C, D, E, H, L, (HL)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,A           7F        4
 * LD             A,B           78        4
 * LD             A,C           79        4
 * LD             A,D           7A        4
 * LD             A,E           7B        4
 * LD             A,H           7C        4
 * LD             A,L           7D        4
 * LD             A,(HL)        7E        8
 * LD             B,B           40        4
 * LD             B,C           41        4
 * LD             B,D           42        4
 * LD             B,E           43        4
 * LD             B,H           44        4
 * LD             B,L           45        4
 * LD             B,(HL)        46        8
 * LD             C,B           48        4
 * LD             C,C           49        4
 * LD             C,D           4A        4
 * LD             C,E           4B        4
 * LD             C,H           4C        4
 * LD             C,L           4D        4
 * LD             C,(HL)        4E        8
 * LD             D,B           50        4
 * LD             D,C           51        4
 * LD             D,D           52        4
 * LD             D,E           53        4
 * LD             D,H           54        4
 * LD             D,L           55        4
 * LD             D,(HL)        56        8
 * LD             E,B           58        4
 * LD             E,C           59        4
 * LD             E,D           5A        4
 * LD             E,E           5B        4
 * LD             E,H           5C        4
 * LD             E,L           5D        4
 * LD             E,(HL)        5E        8
 * LD             H,B           60        4
 * LD             H,C           61        4
 * LD             H,D           62        4
 * LD             H,E           63        4
 * LD             H,H           64        4
 * LD             H,L           65        4
 * LD             H,(HL)        66        8
 * LD             L,B           68        4
 * LD             L,C           69        4
 * LD             L,D           6A        4
 * LD             L,E           6B        4
 * LD             L,H           6C        4
 * LD             L,L           6D        4
 * LD             L,(HL)        6E        8
 * LD             (HL),B        70        8
 * LD             (HL),C        71        8
 * LD             (HL),D        73        8
 * LD             (HL),E        74        8
 * LD             (HL),H        75        8
 * LD             (HL),L        76        8
 * LD             (HL),n        36        12
 */

var LD_r1_r2 = function LD_r1_r2(r1, r2) {
    return function (cpu) {
        cpu[r1] = cpu[r2];
        cpu.pc += 1;

        return 4;
    };
};

$[0x78] = ['LD A,B', LD_r1_r2('a', 'b')];
$[0x79] = ['LD A,C', LD_r1_r2('a', 'c')];
$[0x7a] = ['LD A,D', LD_r1_r2('a', 'd')];
$[0x7b] = ['LD A,E', LD_r1_r2('a', 'e')];
$[0x7c] = ['LD A,H', LD_r1_r2('a', 'h')];
$[0x7d] = ['LD A,L', LD_r1_r2('a', 'l')];
$[0x7f] = ['LD A,A', LD_r1_r2('a', 'a')];

$[0x40] = ['LD B,B', LD_r1_r2('b', 'b')];
$[0x41] = ['LD B,C', LD_r1_r2('b', 'c')];
$[0x42] = ['LD B,D', LD_r1_r2('b', 'd')];
$[0x43] = ['LD B,E', LD_r1_r2('b', 'e')];
$[0x44] = ['LD B,H', LD_r1_r2('b', 'h')];
$[0x45] = ['LD B,L', LD_r1_r2('b', 'l')];

$[0x48] = ['LD C,B', LD_r1_r2('c', 'b')];
$[0x49] = ['LD C,C', LD_r1_r2('c', 'c')];
$[0x4a] = ['LD C,D', LD_r1_r2('c', 'd')];
$[0x4b] = ['LD C,E', LD_r1_r2('c', 'e')];
$[0x4c] = ['LD C,H', LD_r1_r2('c', 'h')];
$[0x4d] = ['LD C,L', LD_r1_r2('c', 'l')];

$[0x50] = ['LD D,B', LD_r1_r2('d', 'b')];
$[0x51] = ['LD D,C', LD_r1_r2('d', 'c')];
$[0x52] = ['LD D,D', LD_r1_r2('d', 'd')];
$[0x53] = ['LD D,E', LD_r1_r2('d', 'e')];
$[0x54] = ['LD D,H', LD_r1_r2('d', 'h')];
$[0x55] = ['LD D,L', LD_r1_r2('d', 'l')];

$[0x58] = ['LD E,B', LD_r1_r2('e', 'b')];
$[0x59] = ['LD E,C', LD_r1_r2('e', 'c')];
$[0x5a] = ['LD E,D', LD_r1_r2('e', 'd')];
$[0x5b] = ['LD E,E', LD_r1_r2('e', 'e')];
$[0x5c] = ['LD E,H', LD_r1_r2('e', 'h')];
$[0x5d] = ['LD E,L', LD_r1_r2('e', 'l')];

$[0x60] = ['LD H,B', LD_r1_r2('h', 'b')];
$[0x61] = ['LD H,C', LD_r1_r2('h', 'c')];
$[0x62] = ['LD H,D', LD_r1_r2('h', 'd')];
$[0x63] = ['LD H,E', LD_r1_r2('h', 'e')];
$[0x64] = ['LD H,H', LD_r1_r2('h', 'h')];
$[0x65] = ['LD H,L', LD_r1_r2('h', 'l')];

$[0x68] = ['LD L,B', LD_r1_r2('l', 'b')];
$[0x69] = ['LD L,C', LD_r1_r2('l', 'c')];
$[0x6a] = ['LD L,D', LD_r1_r2('l', 'd')];
$[0x6b] = ['LD L,E', LD_r1_r2('l', 'e')];
$[0x6c] = ['LD L,H', LD_r1_r2('l', 'h')];
$[0x6d] = ['LD L,L', LD_r1_r2('l', 'l')];

var LD_r_$HL = function LD_r_$HL(r) {
    return function (cpu, mmu) {
        cpu[r] = mmu.readByte(cpu.hl);
        cpu.pc += 1;

        return 8;
    };
};

$[0x46] = ['LD B,(HL)', LD_r_$HL('b')];
$[0x4e] = ['LD C,(HL)', LD_r_$HL('c')];
$[0x56] = ['LD D,(HL)', LD_r_$HL('d')];
$[0x5e] = ['LD E,(HL)', LD_r_$HL('e')];
$[0x66] = ['LD H,(HL)', LD_r_$HL('h')];
$[0x6e] = ['LD L,(HL)', LD_r_$HL('l')];
$[0x7e] = ['LD A,(HL)', LD_r_$HL('a')];

var LD_$HL_r = function LD_$HL_r(r) {
    return function (cpu, mmu) {
        mmu.writeByte(cpu.hl, cpu[r]);
        cpu.pc += 1;

        return 8;
    };
};

$[0x70] = ['LD (HL),B', LD_$HL_r('b')];
$[0x71] = ['LD (HL),C', LD_$HL_r('c')];
$[0x72] = ['LD (HL),D', LD_$HL_r('d')];
$[0x73] = ['LD (HL),E', LD_$HL_r('e')];
$[0x74] = ['LD (HL),H', LD_$HL_r('h')];
$[0x75] = ['LD (HL),L', LD_$HL_r('l')];

$[0x36] = ['LD (HL),n', function (cpu, mmu) {
    mmu.writeByte(cpu.hl, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 12;
}];

/**
 * LD A,n
 *
 * Description:
 * Put value n into A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (BC), (DE), (HL), (nn), #
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,A           7F        4
 * LD             A,B           78        4
 * LD             A,C           79        4
 * LD             A,D           7A        4
 * LD             A,E           7B        4
 * LD             A,H           7C        4
 * LD             A,L           7D        4
 * LD             A,(BC)        0A        8
 * LD             A,(DE)        1A        8
 * LD             A,(HL)        7E        8
 * LD             A,(nn)        FA        16
 * LD             A,#           3E        8
 */

var LD_A_n = function LD_A_n(n) {
    return function (cpu) {
        cpu.a = cpu[n];
        cpu.pc += 1;

        return 4;
    };
};

$[0x78] = ['LD A,B', LD_A_n('b')];
$[0x79] = ['LD A,C', LD_A_n('c')];
$[0x7a] = ['LD A,D', LD_A_n('d')];
$[0x7b] = ['LD A,E', LD_A_n('e')];
$[0x7c] = ['LD A,H', LD_A_n('h')];
$[0x7d] = ['LD A,L', LD_A_n('l')];
$[0x7f] = ['LD A,A', LD_A_n('a')];

var LD_A_$n = function LD_A_$n(n) {
    return function (cpu, mmu) {
        cpu.a = mmu.readByte(cpu[n]);
        cpu.pc += 1;

        return 8;
    };
};

$[0x0a] = ['LD A,(BC)', LD_A_$n('bc')];
$[0x1a] = ['LD A,(DE)', LD_A_$n('de')];
$[0x7e] = ['LD A,(HL)', LD_A_$n('hl')];

$[0xfa] = ['LD A,(nn)', function (cpu, mmu) {
    cpu.a = mmu.readByte(mmu.readWord(cpu.pc + 1));
    cpu.pc += 3;

    return 16;
}];

$[0x3e] = ['LD A,n', function (cpu, mmu) {
    cpu.a = mmu.readByte(cpu.pc + 1);
    cpu.pc += 2;

    return 8;
}];

/**
 * LD n,A
 *
 * Description:
 * Put value A into n.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (BC), (DE), (HL), (nn)
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,A           7F        4
 * LD             B,A           47        4
 * LD             C,A           4F        4
 * LD             D,A           57        4
 * LD             E,A           5F        4
 * LD             H,A           67        4
 * LD             L,A           6F        4
 * LD             (BC),A        02        8
 * LD             (DE),A        12        8
 * LD             (HL),A        77        8
 * LD             (nn),A        EA        16
 */

var LD_n_A = function LD_n_A(n) {
    return function (cpu) {
        cpu[n] = cpu.a;
        cpu.pc += 1;

        return 4;
    };
};

$[0x47] = ['LD B,A', LD_n_A('b')];
$[0x4f] = ['LD C,A', LD_n_A('c')];
$[0x57] = ['LD D,A', LD_n_A('d')];
$[0x5f] = ['LD E,A', LD_n_A('e')];
$[0x67] = ['LD H,A', LD_n_A('h')];
$[0x6f] = ['LD L,A', LD_n_A('l')];
$[0x7f] = ['LD A,A', LD_n_A('a')];

var LD_$n_A = function LD_$n_A(n) {
    return function (cpu, mmu) {
        mmu.writeByte(cpu[n], cpu.a);
        cpu.pc += 1;

        return 8;
    };
};

$[0x02] = ['LD (BC),A', LD_$n_A('bc')];
$[0x12] = ['LD (DE),A', LD_$n_A('de')];
$[0x77] = ['LD (HL),A', LD_$n_A('hl')];

$[0xea] = ['LD (nn),A', function (cpu, mmu) {
    mmu.writeByte(mmu.readWord(cpu.pc + 1), cpu.a);
    cpu.pc += 3;

    return 16;
}];

/**
 * LD A,(C)
 *
 * Description:
 * Put value at address $FF00 + register C into A.
 * Same as: LDA,($FF00+C)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,(C)         F2        8
 */

$[0xf2] = ['LD A,(C)', function (cpu, mmu) {
    cpu.a = mmu.readByte(0xff00 + cpu.c);
    cpu.pc += 1;

    return 8;
}];

/**
 * LD (C),A
 *
 * Description:
 * Put A into address $FF00 + register C.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             ($FF00+C),A   E2        8
 */

$[0xe2] = ['LD (C),A', function (cpu, mmu) {
    mmu.writeByte(0xff00 + cpu.c, cpu.a);
    cpu.pc += 1;

    return 8;
}];

/**
 * LD A,(HLD)
 * LD A,(HL-)
 * LDD A,(HL)
 *
 * Description:
 * Put value at address HL into A. Decrement HL.
 * Same as: LDA,(HL) - DEC HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,(HLD)       3A        8
 * LD             A,(HL-)       3A        8
 * LDD            A,(HL)        3A        8
 */

$[0x3a] = ['LD A,(HL-)', function (cpu, mmu) {
    cpu.a = mmu.readByte(cpu.hl--);
    cpu.pc += 1;

    return 8;
}];

/**
 * LD (HLD),A
 * LD (HL-),A
 * LDD (HL),A
 *
 * Description:
 * Put A into memory address HL. Decrement HL.
 * Same as: LD(HL),A - DEC HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             (HLD),A       32        8
 * LD             (HL-),A       32        8
 * LDD            (HL),A        32        8
 */

$[0x32] = ['LD (HL-),A', function (cpu, mmu) {
    mmu.writeByte(cpu.hl--, cpu.a);
    cpu.pc += 1;

    return 8;
}];

/**
 * LD A,(HLI)
 * LD A,(HL+)
 * LDI A,(HL)
 *
 * Description:
 * Put value at address HL into A. Increment HL.
 * Same as: LDA,(HL) - INC HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,(HLI)       2A        8
 * LD             A,(HL+)       2A        8
 * LDI            A,(HL)        2A        8
 */

$[0x2a] = ['LD A,(HL+)', function (cpu, mmu) {
    cpu.a = mmu.readByte(cpu.hl++);
    cpu.pc += 1;

    return 8;
}];

/**
 * LD (HLI),A
 * LD (HL+),A
 * LDI (HL),A
 *
 * Description:
 * Put A into memory address HL. Increment HL.
 * Same as: LD(HL),A - INC HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             (HLI),A       22        8
 * LD             (HL+),A       22        8
 * LDI            (HL),A        22        8
 */

$[0x22] = ['LD (HL+),A', function (cpu, mmu) {
    mmu.writeByte(cpu.hl++, cpu.a);
    cpu.pc += 1;

    return 8;
}];

/**
 * LDH (n),A
 *
 * Description:
 * Put A into memory address $FF00+n.
 *
 * Use with:
 * n = one byte immediate value.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             ($FF00+n),A   E0        12
 */

$[0xe0] = ['LDH (n),A', function (cpu, mmu) {
    var n = mmu.readByte(cpu.pc + 1);
    mmu.writeByte(0xff00 + n, cpu.a);
    cpu.pc += 2;

    return 12;
}];

/**
 * LDH A,(n)
 *
 * Description:
 * Put memory address $FF00+n into A.
 *
 * Use with:
 * n = one byte immediate value.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             A,($FF00+n)   F0        12
 */

$[0xf0] = ['LDH A,(n)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.pc + 1);
    cpu.a = mmu.readByte(0xff00 + n);
    cpu.pc += 2;

    return 12;
}];

// 16-Bit Loads

/**
 * LD n,nn
 *
 * Description:
 * Put value nn into n.
 *
 * Use with:
 * n = BC, DE, HL, SP
 * nn = 16 bit immediate value
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             BC,nn         01        12
 * LD             DE,nn         11        12
 * LD             HL,nn         21        12
 * LD             SP,nn         31        12
 */

var LD_n_nn = function LD_n_nn(n) {
    return function (cpu, mmu) {
        cpu[n] = mmu.readWord(cpu.pc + 1);
        cpu.pc += 3;

        return 12;
    };
};

$[0x01] = ['LD BC,nn', LD_n_nn('bc')];
$[0x11] = ['LD DE,nn', LD_n_nn('de')];
$[0x21] = ['LD HL,nn', LD_n_nn('hl')];
$[0x31] = ['LD SP,nn', LD_n_nn('sp')];

/**
 * LD SP,HL
 *
 * Description:
 * Put HL into Stack Pointer (SP).
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             SP,HL         F9        8
 */

$[0xf9] = ['LD SP,HL', function (cpu) {
    cpu.sp = cpu.hl;
    cpu.pc += 1;

    return 8;
}];

/**
 * LD HL,SP+n
 * LDHL SP,n
 *
 * Description
 * Put SP + n effective address into HL.
 *
 * Use with:
 * n = one byte signed immediate value.
 *
 * Flags affected:
 * Z - Reset.
 * N - Reset.
 * H - Set or reset according to operation.
 * C - Set or reset according to operation.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LDHL           SP,n          F8        12
 */

function add_sp_n(cpu, mmu) {
    var n = mmu.readByte(cpu.pc + 1).signed();
    var r = cpu.sp + n;

    var op = cpu.sp ^ n ^ r;

    cpu.f = 0;
    if ((op & 0x10) != 0) cpu.f |= FLAG_H;
    if ((op & 0x100) != 0) cpu.f |= FLAG_C;

    return r;
}

$[0xf8] = ['LD HL,SP+n', function (cpu, mmu) {
    cpu.hl = add_sp_n(cpu, mmu);
    cpu.pc += 2;

    return 12;
}];

/**
 * LD (nn),SP
 *
 * Description:
 * Put Stack Pointer (SP) at address n.
 *
 * Use with:
 * nn = two byte immediate address.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * LD             (nn),SP       08        20
 */

$[0x08] = ['LD (nn),SP', function (cpu, mmu) {
    mmu.writeWord(mmu.readWord(cpu.pc + 1), cpu.sp);
    cpu.pc += 3;

    return 20;
}];

/**
 * PUSH nn
 *
 * Description:
 * Push register pair nn onto stack. Decrement Stack Pointer (SP) twice.
 *
 * Use with:
 * nn = AF, BC, DE, HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * PUSH           AF            F5        16
 * PUSH           BC            C5        16
 * PUSH           DE            D5        16
 * PUSH           HL            E5        16
 */

var PUSH_nn = function PUSH_nn(nn) {
    return function (cpu, mmu) {
        mmu.writeWord(cpu.sp -= 2, cpu[nn]);
        cpu.pc += 1;

        return 16;
    };
};

$[0xc5] = ['PUSH BC', PUSH_nn('bc')];
$[0xd5] = ['PUSH DE', PUSH_nn('de')];
$[0xe5] = ['PUSH HL', PUSH_nn('hl')];
$[0xf5] = ['PUSH AF', PUSH_nn('af')];

/**
 * POP nn
 *
 * Description:
 * Pop two bytes off stack into register pair nn. Increment Stack Pointer (SP)
 * twice.
 *
 * Use with:
 * nn = AF, BC, DE, HL
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * POP            AF            F1        12
 * POP            BC            C1        12
 * POP            DE            D1        12
 * POP            HL            E1        12
 */

var POP_nn = function POP_nn(nn) {
    return function (cpu, mmu) {
        cpu[nn] = mmu.readWord(cpu.sp);
        cpu.sp += 2;
        cpu.pc += 1;

        return 12;
    };
};

$[0xc1] = ['POP BC', POP_nn('bc')];
$[0xd1] = ['POP DE', POP_nn('de')];
$[0xe1] = ['POP HL', POP_nn('hl')];
$[0xf1] = ['POP AF', POP_nn('af')];

// 8-Bit ALU

/**
 * ADD A,n
 *
 * Description:
 * Add n to A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Set if carry from bit 3.
 * C - Set if carry from bit 7.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * ADD            A,A           87        4
 * ADD            A,B           80        4
 * ADD            A,C           81        4
 * ADD            A,D           82        4
 * ADD            A,E           83        4
 * ADD            A,H           84        4
 * ADD            A,L           85        4
 * ADD            A,(HL)        86        8
 * ADD            A,#           C6        8
 */

function add(cpu, n) {
    var r = cpu.a + n;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if (((cpu.a ^ n ^ r) & 0x10) != 0) cpu.f |= FLAG_H;
    if ((r & 0x100) != 0) cpu.f |= FLAG_C;

    return r;
}

var ADD_A_n = function ADD_A_n(n) {
    return function (cpu) {
        cpu.a = add(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x80] = ['ADD A,B', ADD_A_n('b')];
$[0x81] = ['ADD A,C', ADD_A_n('c')];
$[0x82] = ['ADD A,D', ADD_A_n('d')];
$[0x83] = ['ADD A,E', ADD_A_n('e')];
$[0x84] = ['ADD A,H', ADD_A_n('h')];
$[0x85] = ['ADD A,L', ADD_A_n('l')];
$[0x87] = ['ADD A,A', ADD_A_n('a')];

$[0x86] = ['ADD A,(HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    cpu.a = add(cpu, n);
    cpu.pc += 1;

    return 8;
}];

$[0xc6] = ['ADD A,#', function (cpu, mmu) {
    var n = mmu.readByte(cpu.pc + 1);
    cpu.a = add(cpu, n);
    cpu.pc += 2;

    return 8;
}];

/**
 * ADC A,n
 *
 * Description:
 * Add n + Carry flag to A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Set if carry from bit 3.
 * C - Set if carry from bit 7.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * ADC            A,A           8F        4
 * ADC            A,B           88        4
 * ADC            A,C           89        4
 * ADC            A,D           8A        4
 * ADC            A,E           8B        4
 * ADC            A,H           8C        4
 * ADC            A,L           8D        4
 * ADC            A,(HL)        8E        8
 * ADC            A,#           CE        8
 */

function adc(cpu, n) {
    var cy = cpu.f >> 4 & 1;
    var r = cpu.a + n + cy;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if (((cpu.a ^ n ^ r) & 0x10) != 0) cpu.f |= FLAG_H;
    if ((r & 0x100) != 0) cpu.f |= FLAG_C;

    return r;
}

var ADC_A_n = function ADC_A_n(n) {
    return function (cpu) {
        cpu.a = adc(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x88] = ['ADC A,B', ADC_A_n('b')];
$[0x89] = ['ADC A,C', ADC_A_n('c')];
$[0x8a] = ['ADC A,D', ADC_A_n('d')];
$[0x8b] = ['ADC A,E', ADC_A_n('e')];
$[0x8c] = ['ADC A,H', ADC_A_n('h')];
$[0x8d] = ['ADC A,L', ADC_A_n('l')];
$[0x8f] = ['ADC A,A', ADC_A_n('a')];

$[0x8e] = ['ADC A,(HL)', function (cpu, mmu) {
    cpu.a = adc(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xce] = ['ADC A,#', function (cpu, mmu) {
    cpu.a = adc(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * SUB n
 *
 * Description:
 * Subtract n from A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Set.
 * H - Set if no borrow from bit 4.
 * C - Set if no borrow.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SUB            A             97        4
 * SUB            B             90        4
 * SUB            C             91        4
 * SUB            D             92        4
 * SUB            E             93        4
 * SUB            H             94        4
 * SUB            L             95        4
 * SUB            (HL)          96        8
 * SUB            #             D6        8
 */

function sub(cpu, n) {
    var r = cpu.a - n;

    cpu.f = FLAG_N;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if (((cpu.a ^ n ^ r) & 0x10) != 0) cpu.f |= FLAG_H;
    if ((r & 0x100) != 0) cpu.f |= FLAG_C;

    return r;
}

var SUB_n = function SUB_n(n) {
    return function (cpu) {
        cpu.a = sub(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x90] = ['SUB B', SUB_n('b')];
$[0x91] = ['SUB C', SUB_n('c')];
$[0x92] = ['SUB D', SUB_n('d')];
$[0x93] = ['SUB E', SUB_n('e')];
$[0x94] = ['SUB H', SUB_n('h')];
$[0x95] = ['SUB L', SUB_n('l')];
$[0x97] = ['SUB A', SUB_n('a')];

$[0x96] = ['SUB (HL)', function (cpu, mmu) {
    cpu.a = sub(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xd6] = ['SUB #', function (cpu, mmu) {
    cpu.a = sub(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * SBC A,n
 *
 * Description:
 * Subtract n + Carry flag from A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Set.
 * H - Set if no borrow from bit 4.
 * C - Set if no borrow.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SBC            A,A           9F        4
 * SBC            A,B           98        4
 * SBC            A,C           99        4
 * SBC            A,D           9A        4
 * SBC            A,E           9B        4
 * SBC            A,H           9C        4
 * SBC            A,L           9D        4
 * SBC            A,(HL)        9E        8
 * SBC            A,#           DE        8
 */

function sbc(cpu, n) {
    var cy = cpu.f >> 4 & 1;
    var r = cpu.a - n - cy;

    cpu.f = FLAG_N;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if (((cpu.a ^ n ^ r) & 0x10) != 0) cpu.f |= FLAG_H;
    if ((r & 0x100) != 0) cpu.f |= FLAG_C;

    return r;
}

var SBC_A_n = function SBC_A_n(n) {
    return function (cpu) {
        cpu.a = sbc(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x98] = ['SBC A,B', SBC_A_n('b')];
$[0x99] = ['SBC A,C', SBC_A_n('c')];
$[0x9a] = ['SBC A,D', SBC_A_n('d')];
$[0x9b] = ['SBC A,E', SBC_A_n('e')];
$[0x9c] = ['SBC A,H', SBC_A_n('h')];
$[0x9d] = ['SBC A,L', SBC_A_n('l')];
$[0x9f] = ['SBC A,A', SBC_A_n('a')];

$[0x9e] = ['SBC A,(HL)', function (cpu, mmu) {
    cpu.a = sbc(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xde] = ['SBC A,#', function (cpu, mmu) {
    cpu.a = sbc(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * AND n
 *
 * Description:
 * Logically AND n with A, result in A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Set.
 * C - Reset.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * AND            A             A7        4
 * AND            B             A0        4
 * AND            C             A1        4
 * AND            D             A2        4
 * AND            E             A3        4
 * AND            H             A4        4
 * AND            L             A5        4
 * AND            (HL)          A6        8
 * AND            #             E6        8
 */

function and(cpu, n) {
    var r = cpu.a & n;

    cpu.f = FLAG_H;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;

    return r;
}

var AND_n = function AND_n(n) {
    return function (cpu) {
        cpu.a = and(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0xa0] = ['AND B', AND_n('b')];
$[0xa1] = ['AND C', AND_n('c')];
$[0xa2] = ['AND D', AND_n('d')];
$[0xa3] = ['AND E', AND_n('e')];
$[0xa4] = ['AND H', AND_n('h')];
$[0xa5] = ['AND L', AND_n('l')];
$[0xa7] = ['AND A', AND_n('a')];

$[0xa6] = ['AND (HL)', function (cpu, mmu) {
    cpu.a = and(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xe6] = ['AND #', function (cpu, mmu) {
    cpu.a = and(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * OR n
 *
 * Description:
 * Logical OR n with register A, result in A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Reset.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * OR             A             B7        4
 * OR             B             B0        4
 * OR             C             B1        4
 * OR             D             B2        4
 * OR             E             B3        4
 * OR             H             B4        4
 * OR             L             B5        4
 * OR             (HL)          B6        8
 * OR             #             F6        8
 */

function or(cpu, n) {
    var r = cpu.a | n;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;

    return r;
}

var OR_n = function OR_n(n) {
    return function (cpu) {
        cpu.a = or(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0xb0] = ['OR B', OR_n('b')];
$[0xb1] = ['OR C', OR_n('c')];
$[0xb2] = ['OR D', OR_n('d')];
$[0xb3] = ['OR E', OR_n('e')];
$[0xb4] = ['OR H', OR_n('h')];
$[0xb5] = ['OR L', OR_n('l')];
$[0xb7] = ['OR A', OR_n('a')];

$[0xb6] = ['OR (HL)', function (cpu, mmu) {
    cpu.a = or(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 4;
}];

$[0xf6] = ['OR #', function (cpu, mmu) {
    cpu.a = or(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 4;
}];

/**
 * XOR n
 *
 * Description:
 * Logical exclusive OR n with register A, result in A.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Reset.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * XOR            A             AF        4
 * XOR            B             A8        4
 * XOR            C             A9        4
 * XOR            D             AA        4
 * XOR            E             AB        4
 * XOR            H             AC        4
 * XOR            L             AD        4
 * XOR            (HL)          AE        8
 * XOR            #             EE        8
 */

function xor(cpu, n) {
    var r = cpu.a ^ n;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;

    return r;
}

var XOR_n = function XOR_n(n) {
    return function (cpu) {
        cpu.a = xor(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0xa8] = ['XOR B', XOR_n('b')];
$[0xa9] = ['XOR C', XOR_n('c')];
$[0xaa] = ['XOR D', XOR_n('d')];
$[0xab] = ['XOR E', XOR_n('e')];
$[0xac] = ['XOR H', XOR_n('h')];
$[0xad] = ['XOR L', XOR_n('l')];
$[0xaf] = ['XOR A', XOR_n('a')];

$[0xae] = ['XOR (HL)', function (cpu, mmu) {
    cpu.a = xor(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xee] = ['XOR #', function (cpu, mmu) {
    cpu.a = xor(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * CP n
 *
 * Description:
 * Compare A with n. This is basically an A - n subtraction instruction but the
 * results are thrown away.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL), #
 *
 * Flags affected:
 * Z - Set if result is zero. (Set if A=n.)
 * N - Set.
 * H - Set if no borrow from bit 4.
 * C - Set for no borrow. (Set if A<n.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * CP             A             BF        4
 * CP             B             B8        4
 * CP             C             B9        4
 * CP             D             BA        4
 * CP             E             BB        4
 * CP             H             BC        4
 * CP             L             BD        4
 * CP             (HL)          BE        8
 * CP             #             FE        8
 */

var CP_n = function CP_n(n) {
    return function (cpu) {
        sub(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0xb8] = ['CP B', CP_n('b')];
$[0xb9] = ['CP C', CP_n('c')];
$[0xba] = ['CP D', CP_n('d')];
$[0xbb] = ['CP E', CP_n('e')];
$[0xbc] = ['CP H', CP_n('h')];
$[0xbd] = ['CP L', CP_n('l')];
$[0xbf] = ['CP A', CP_n('a')];

$[0xbe] = ['CP (HL)', function (cpu, mmu) {
    sub(cpu, mmu.readByte(cpu.hl));
    cpu.pc += 1;

    return 8;
}];

$[0xfe] = ['CP #', function (cpu, mmu) {
    sub(cpu, mmu.readByte(cpu.pc + 1));
    cpu.pc += 2;

    return 8;
}];

/**
 * INC n
 *
 * Description:
 * Increment register n.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Set if carry from bit 3.
 * C - Not affected.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * INC            A             3C        4
 * INC            B             04        4
 * INC            C             0C        4
 * INC            D             14        4
 * INC            E             1C        4
 * INC            H             24        4
 * INC            L             2C        4
 * INC            (HL)          34        12
 */

function inc(cpu, n) {
    var r = n + 1;

    cpu.f &= ~0xe0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 0xf) == 0xf) cpu.f |= FLAG_H;

    return r;
}

var INC_n = function INC_n(n) {
    return function (cpu) {
        cpu[n] = inc(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x04] = ['INC B', INC_n('b')];
$[0x0c] = ['INC C', INC_n('c')];
$[0x14] = ['INC D', INC_n('d')];
$[0x1c] = ['INC E', INC_n('e')];
$[0x24] = ['INC H', INC_n('h')];
$[0x2c] = ['INC L', INC_n('l')];
$[0x3c] = ['INC A', INC_n('a')];

$[0x34] = ['INC (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, inc(cpu, n));
    cpu.pc += 1;

    return 12;
}];

/**
 * DEC n
 *
 * Description:
 * Decrement register n.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if reselt is zero.
 * N - Set.
 * H - Set if no borrow from bit 4.
 * C - Not affected.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * DEC            A             3D        4
 * DEC            B             05        4
 * DEC            C             0D        4
 * DEC            D             15        4
 * DEC            E             1D        4
 * DEC            H             25        4
 * DEC            L             2D        4
 * DEC            (HL)          35        12
 */

function dec(cpu, n) {
    var r = n - 1;

    cpu.f &= ~0xe0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    cpu.f |= FLAG_N;
    if ((n & 0xf) == 0) cpu.f |= FLAG_H;

    return r;
}

var DEC_n = function DEC_n(n) {
    return function (cpu) {
        cpu[n] = dec(cpu, cpu[n]);
        cpu.pc += 1;

        return 4;
    };
};

$[0x05] = ['DEC B', DEC_n('b')];
$[0x0d] = ['DEC C', DEC_n('c')];
$[0x15] = ['DEC D', DEC_n('d')];
$[0x1d] = ['DEC E', DEC_n('e')];
$[0x25] = ['DEC H', DEC_n('h')];
$[0x2d] = ['DEC L', DEC_n('l')];
$[0x3d] = ['DEC A', DEC_n('a')];

$[0x35] = ['DEC (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, dec(cpu, n));
    cpu.pc += 1;

    return 12;
}];

// 16-Bit Arithmetic

/**
 * ADD HL,n
 *
 * Description:
 * Add n to HL.
 *
 * Use with:
 * n = BC, DE, HL, SP
 *
 * Flags affected:
 * Z - Not affected.
 * N - Reset.
 * H - Set if carry from bit 11.
 * C - Set if carry from bit 15.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * ADD            HL,BC         09        8
 * ADD            HL,DE         19        8
 * ADD            HL,HL         29        8
 * ADD            HL,SP         39        8
 */

var ADD_HL_n = function ADD_HL_n(n) {
    return function (cpu, mmu) {
        var r = cpu.hl + cpu[n];

        cpu.f &= ~0x70;
        if (((cpu.hl ^ cpu[n] ^ r) & 0x1000) != 0) cpu.f |= FLAG_H;
        if ((r & 0x10000) != 0) cpu.f |= FLAG_C;

        cpu.hl = r;
        cpu.pc += 1;

        return 8;
    };
};

$[0x09] = ['ADD HL,BC', ADD_HL_n('bc')];
$[0x19] = ['ADD HL,DE', ADD_HL_n('de')];
$[0x29] = ['ADD HL,HL', ADD_HL_n('hl')];
$[0x39] = ['ADD HL,SP', ADD_HL_n('sp')];

/**
 * ADD SP,n
 *
 * Description:
 * Add n to Stack Pointer (SP).
 *
 * Use with:
 * n = one byte signed immediate value (#).
 *
 * Flags affected:
 * Z - Reset.
 * N - Reset.
 * H - Set or reset according to operation.
 * C - Set or reset according to operation.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * ADD            SP,#          E8        16
 */

$[0xe8] = ['ADD SP,#', function (cpu, mmu) {
    cpu.sp = add_sp_n(cpu, mmu);
    cpu.pc += 2;

    return 16;
}];

/**
 * INC nn
 *
 * Description:
 * Increment register nn.
 *
 * Use with:
 * nn = BC, DE, HL, SP
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * INC            BC            03        8
 * INC            DE            13        8
 * INC            HL            23        8
 * INC            SP            33        8
 */

var INC_nn = function INC_nn(nn) {
    return function (cpu) {
        cpu[nn]++;
        cpu.pc += 1;

        return 8;
    };
};

$[0x03] = ['INC BC', INC_nn('bc')];
$[0x13] = ['INC DE', INC_nn('de')];
$[0x23] = ['INC HL', INC_nn('hl')];
$[0x33] = ['INC SP', INC_nn('sp')];

/**
 * DEC nn
 *
 * Description:
 * Decrement register nn.
 *
 * Use with:
 * nn = BC, DE, HL, SP
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * DEC            BC            0B        8
 * DEC            DE            1B        8
 * DEC            HL            2B        8
 * DEC            SP            3B        8
 */

var DEC_nn = function DEC_nn(nn) {
    return function (cpu) {
        cpu[nn]--;
        cpu.pc += 1;

        return 8;
    };
};

$[0x0b] = ['DEC BC', DEC_nn('bc')];
$[0x1b] = ['DEC DE', DEC_nn('de')];
$[0x2b] = ['DEC HL', DEC_nn('hl')];
$[0x3b] = ['DEC SP', DEC_nn('sp')];

// Miscellaneous

/**
 * SWAP n
 *
 * Description:
 * Swap upper & lower nibles of n.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Reset.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SWAP           A             CB 37     8
 * SWAP           B             CB 30     8
 * SWAP           C             CB 31     8
 * SWAP           D             CB 32     8
 * SWAP           E             CB 33     8
 * SWAP           H             CB 34     8
 * SWAP           L             CB 35     8
 * SWAP           (HL)          CB 36     16
 */

function swap(cpu, n) {
    var r = n << 4 | n >> 4;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;

    return r;
}

var SWAP_n = function SWAP_n(n) {
    return function (cpu) {
        cpu[n] = swap(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x30] = ['SWAP B', SWAP_n('b')];
$cb[0x31] = ['SWAP C', SWAP_n('c')];
$cb[0x32] = ['SWAP D', SWAP_n('d')];
$cb[0x33] = ['SWAP E', SWAP_n('e')];
$cb[0x34] = ['SWAP H', SWAP_n('h')];
$cb[0x35] = ['SWAP L', SWAP_n('l')];
$cb[0x37] = ['SWAP A', SWAP_n('a')];

$cb[0x36] = ['SWAP (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, swap(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * DAA
 *
 * Description:
 * Decimal adjust register A.
 * This instruction adjusts register A so that the correct representation of
 * Binary Coded Decimal (BCD) is obtained.
 *
 * Flags affected:
 * Z - Set if register A is zero.
 * N - Not affected.
 * H - Reset.
 * C - Set or reset according to operation
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * DAA            - / -         27        4
 */

$[0x27] = ['DAA', function (cpu) {
    var r = void 0;
    var adjust = 0;

    if (cpu.f & FLAG_H) adjust |= 0x06;
    if (cpu.f & FLAG_C) adjust |= 0x60;

    if (cpu.f & FLAG_N) r = cpu.a - adjust;else {
        if ((cpu.a & 0xf) > 0x9) adjust |= 0x06;
        if (cpu.a > 0x99) adjust |= 0x60;
        r = cpu.a + adjust;
    }

    cpu.f &= ~0xb0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((adjust & 0x60) != 0) cpu.f |= FLAG_C;

    cpu.a = r;
    cpu.pc += 1;

    return 4;
}];

/**
 * CPL
 *
 * Description:
 * Complement A register. (Flip all bits.)
 *
 * Flags affected:
 * Z - Not affected.
 * N - Set.
 * H - Set.
 * C - Not affected.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * CPL            - / -         2F        4
 */

$[0x2f] = ['CPL', function (cpu) {
    cpu.a ^= 0xff;
    cpu.f |= 0x60;

    cpu.pc += 1;

    return 4;
}];

/**
 * CCF
 *
 * Description:
 * Complement carry flag.
 * If C flag is set, then reset it.
 * If C flag is reset, then set it.
 *
 * Flags affected:
 * Z - Not affected.
 * N - Reset.
 * H - Reset.
 * C - Complemented.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * CFF            - / -         3F        4
 */

$[0x3f] = ['CCF', function (cpu) {
    cpu.f &= ~0x60;
    cpu.f ^= FLAG_C;

    cpu.pc += 1;

    return 4;
}];

/**
 * SCF
 *
 * Description:
 * Set Carry flag.
 *
 * Flags affected:
 * Z - Not affected.
 * N - Reset.
 * H - Reset.
 * C - Set.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SCF            - / -         37        4
 */

$[0x37] = ['SCF', function (cpu) {
    cpu.f &= ~0x60;
    cpu.f |= FLAG_C;

    cpu.pc += 1;

    return 4;
}];

/**
 * NOP
 *
 * Description:
 * No operation.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * NOP            - / -         00        4
 */

$[0x00] = ['NOP', function (cpu) {
    cpu.pc += 1;

    return 4;
}];

/**
 * HALT
 *
 * Description:
 * Power down CPU until an interrupt occurs. Use this when ever possible to
 * reduce energy consumption.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * NOP            - / -         76        4
 */

$[0x76] = ['HALT', function (cpu) {
    cpu.pc += 1;

    return 4;
}];

/**
 * STOP
 *
 * Description:
 * Halt CPU & LCD display until button pressed.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * STOP           - / -         10 00     4
 */

$[0x10] = ['STOP', function (cpu) {
    cpu.pc += 2;

    return 4;
}];

/**
 * DI
 *
 * Description:
 * This instruction disables interrupts but not immediately. Interrupts
 * instruction after DI is executed.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * DI             - / -         F3        4
 */

$[0xf3] = ['DI', function (cpu) {
    cpu.ime = false;
    cpu.pc += 1;

    return 4;
}];

/**
 * EI
 *
 * Description:
 * Enable interrupts. This intruction enables interrupts but not immediately.
 * Interrupts are enabled after instruction after EI is executed.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * EI             - / -         FB        4
 */

$[0xfb] = ['EI', function (cpu) {
    cpu.ime = true;
    cpu.pc += 1;

    return 4;
}];

// Rotates & Shifts

/**
 * RLCA
 *
 * Description:
 * Rotate A left. Old bit 7 to Carry flag.
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 7 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RLCA           - / -         07        4
 */

$[0x07] = ['RLCA', function (cpu) {
    var cy = cpu.a >> 7;

    cpu.f = 0;
    if (cy != 0) cpu.f |= FLAG_C;

    cpu.a = cpu.a << 1 | cy;
    cpu.pc += 1;

    return 4;
}];

/**
 * RLA
 *
 * Description:
 * Rotate A left through Carry flag.
 *
 * Flags affected:
 * Z - Set if result is zero
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 7 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RLA            - / -          17        4
 */

$[0x17] = ['RLA', function (cpu) {
    var newcarry = cpu.a >> 7;
    var oldcarry = cpu.f >> 4 & 1;

    cpu.f = 0;
    if (newcarry != 0) cpu.f |= FLAG_C;

    cpu.a = cpu.a << 1 | oldcarry;
    cpu.pc += 1;

    return 4;
}];

/**
 * RRCA
 *
 * Description:
 * Rotate A right. Old bit 0 to Carry flag.
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RRCA           - / -         0F        4
 */

$[0x0f] = ['RRCA', function (cpu) {
    var cy = cpu.a & 1;

    cpu.f = 0;
    if (cy != 0) cpu.f |= FLAG_C;

    cpu.a = cpu.a >> 1 | cy << 7;
    cpu.pc += 1;

    return 4;
}];

/**
 * RRA
 *
 * Description:
 * Rotate A right through Carry flag.
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RRA            - / -         1F        4
 */

$[0x1f] = ['RRA', function (cpu) {
    var newcarry = cpu.a & 1;
    var oldcarry = cpu.f >> 4 & 1;

    cpu.f = 0;
    if (newcarry != 0) cpu.f |= FLAG_C;

    cpu.a = cpu.a >> 1 | oldcarry << 7;
    cpu.pc += 1;

    return 4;
}];

/**
 * RLC n
 *
 * Description
 * Rotate n left. Old bit 7 to Carry flag.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 7 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RLC            A             CB 07     8
 * RLC            B             CB 00     8
 * RLC            C             CB 01     8
 * RLC            D             CB 02     8
 * RLC            E             CB 03     8
 * RLC            H             CB 04     8
 * RLC            L             CB 05     8
 * RLC            (HL)          CB 06     16
 */

function rlc(cpu, n) {
    var r = n << 1 | n >> 7;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 0x80) != 0) cpu.f |= FLAG_C;

    return r;
}

var RLC_n = function RLC_n(n) {
    return function (cpu) {
        cpu[n] = rlc(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x00] = ['RLC B', RLC_n('b')];
$cb[0x01] = ['RLC C', RLC_n('c')];
$cb[0x02] = ['RLC D', RLC_n('d')];
$cb[0x03] = ['RLC E', RLC_n('e')];
$cb[0x04] = ['RLC H', RLC_n('h')];
$cb[0x05] = ['RLC L', RLC_n('l')];
$cb[0x07] = ['RLC A', RLC_n('a')];

$cb[0x06] = ['RLC (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, rlc(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * RL n
 *
 * Description:
 * Rotate n left through Carry flag.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 7 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RL             A             CB 17     8
 * RL             B             CB 10     8
 * RL             C             CB 11     8
 * RL             D             CB 12     8
 * RL             E             CB 13     8
 * RL             H             CB 14     8
 * RL             L             CB 15     8
 * RL             (HL)          CB 16     16
 */

function rl(cpu, n) {
    var cy = cpu.f >> 4 & 1;
    var r = n << 1 | cy;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 0x80) != 0) cpu.f |= FLAG_C;

    return r;
}

var RL_n = function RL_n(n) {
    return function (cpu) {
        cpu[n] = rl(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x10] = ['RL B', RL_n('b')];
$cb[0x11] = ['RL C', RL_n('c')];
$cb[0x12] = ['RL D', RL_n('d')];
$cb[0x13] = ['RL E', RL_n('e')];
$cb[0x14] = ['RL H', RL_n('h')];
$cb[0x15] = ['RL L', RL_n('l')];
$cb[0x17] = ['RL A', RL_n('a')];

$cb[0x16] = ['RL (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, rl(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * RRC n
 *
 * Description:
 * Rotate n right. Old bit 0 to Carry flag.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RRC            A             CB 0F     8
 * RRC            B             CB 08     8
 * RRC            C             CB 09     8
 * RRC            D             CB 0A     8
 * RRC            E             CB 0B     8
 * RRC            H             CB 0C     8
 * RRC            L             CB 0D     8
 * RRC            (HL)          CB 0E     16
 */

function rrc(cpu, n) {
    var r = n >> 1 | n << 7;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 1) != 0) cpu.f |= FLAG_C;

    return r;
}

var RRC_n = function RRC_n(n) {
    return function (cpu) {
        cpu[n] = rrc(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x08] = ['RRC B', RRC_n('b')];
$cb[0x09] = ['RRC C', RRC_n('c')];
$cb[0x0a] = ['RRC D', RRC_n('d')];
$cb[0x0b] = ['RRC E', RRC_n('e')];
$cb[0x0c] = ['RRC H', RRC_n('h')];
$cb[0x0d] = ['RRC L', RRC_n('l')];
$cb[0x0f] = ['RRC A', RRC_n('a')];

$cb[0x0e] = ['RRC (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, rrc(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * RR n
 *
 * Description:
 * Rotate n right through Carry flag.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RR             A             CB 1F     8
 * RR             B             CB 18     8
 * RR             C             CB 19     8
 * RR             D             CB 1A     8
 * RR             E             CB 1B     8
 * RR             H             CB 1C     8
 * RR             L             CB 1D     8
 * RR             (HL)          CB 1E     16
 */

function rr(cpu, n) {
    var cy = cpu.f >> 4 & 1;
    var r = cy << 7 | n >> 1;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 1) != 0) cpu.f |= FLAG_C;

    return r;
}

var RR_n = function RR_n(n) {
    return function (cpu) {
        cpu[n] = rr(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x18] = ['RR B', RR_n('b')];
$cb[0x19] = ['RR C', RR_n('c')];
$cb[0x1a] = ['RR D', RR_n('d')];
$cb[0x1b] = ['RR E', RR_n('e')];
$cb[0x1c] = ['RR H', RR_n('h')];
$cb[0x1d] = ['RR L', RR_n('l')];
$cb[0x1f] = ['RR A', RR_n('a')];

$cb[0x1e] = ['RR (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, rr(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * SLA n
 *
 * Description:
 * Shift n left into Carry. LSB of n set to 0.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 7 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SLA            A             CB 27     8
 * SLA            B             CB 20     8
 * SLA            C             CB 21     8
 * SLA            D             CB 22     8
 * SLA            E             CB 23     8
 * SLA            H             CB 24     8
 * SLA            L             CB 25     8
 * SLA            (HL)          CB 26     16
 */

function sla(cpu, n) {
    var r = n << 1;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 0x80) != 0) cpu.f |= FLAG_C;

    return r;
}

var SLA_n = function SLA_n(n) {
    return function (cpu) {
        cpu[n] = sla(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x20] = ['SLA B', SLA_n('b')];
$cb[0x21] = ['SLA C', SLA_n('c')];
$cb[0x22] = ['SLA D', SLA_n('d')];
$cb[0x23] = ['SLA E', SLA_n('e')];
$cb[0x24] = ['SLA H', SLA_n('h')];
$cb[0x25] = ['SLA L', SLA_n('l')];
$cb[0x27] = ['SLA A', SLA_n('a')];

$cb[0x26] = ['SLA (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, sla(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * SRA n
 *
 * Description:
 * Shift n right into Carry. MSB doesn't change.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SRA            A             CB 2F     8
 * SRA            B             CB 28     8
 * SRA            C             CB 29     8
 * SRA            D             CB 2A     8
 * SRA            E             CB 2B     8
 * SRA            H             CB 2C     8
 * SRA            L             CB 2D     8
 * SRA            (HL)          CB 2E     16
 */

function sra(cpu, n) {
    var r = n & 0x80 | n >> 1;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 1) != 0) cpu.f |= FLAG_C;

    return r;
}

var SRA_n = function SRA_n(n) {
    return function (cpu) {
        cpu[n] = sra(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x28] = ['SRA B', SRA_n('b')];
$cb[0x29] = ['SRA C', SRA_n('c')];
$cb[0x2a] = ['SRA D', SRA_n('d')];
$cb[0x2b] = ['SRA E', SRA_n('e')];
$cb[0x2c] = ['SRA H', SRA_n('h')];
$cb[0x2d] = ['SRA L', SRA_n('l')];
$cb[0x2f] = ['SRA A', SRA_n('a')];

$cb[0x2e] = ['SRA (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, sra(cpu, n));
    cpu.pc += 2;

    return 16;
}];

/**
 * SRL n
 *
 * Description
 * Shift n right into Carry. MSB set to 0.
 *
 * Use with:
 * n = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if result is zero.
 * N - Reset.
 * H - Reset.
 * C - Contains old bit 0 data.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SRL            A             CB 3F     8
 * SRL            B             CB 38     8
 * SRL            C             CB 39     8
 * SRL            D             CB 3A     8
 * SRL            E             CB 3B     8
 * SRL            H             CB 3C     8
 * SRL            L             CB 3D     8
 * SRL            (HL)          CB 3E     16
 */

function srl(cpu, n) {
    var r = n >> 1;

    cpu.f = 0;
    if ((r & 0xff) == 0) cpu.f |= FLAG_Z;
    if ((n & 1) != 0) cpu.f |= FLAG_C;

    return r;
}

var SRL_n = function SRL_n(n) {
    return function (cpu) {
        cpu[n] = srl(cpu, cpu[n]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x38] = ['SRL B', SRL_n('b')];
$cb[0x39] = ['SRL C', SRL_n('c')];
$cb[0x3a] = ['SRL D', SRL_n('d')];
$cb[0x3b] = ['SRL E', SRL_n('e')];
$cb[0x3c] = ['SRL H', SRL_n('h')];
$cb[0x3d] = ['SRL L', SRL_n('l')];
$cb[0x3f] = ['SRL A', SRL_n('a')];

$cb[0x3e] = ['SRL (HL)', function (cpu, mmu) {
    var n = mmu.readByte(cpu.hl);
    mmu.writeByte(cpu.hl, srl(cpu, n));
    cpu.pc += 2;

    return 16;
}];

// Bit Opcodes

/**
 * BIT b,r
 *
 * Description:
 * Test bit b in register r.
 *
 * Use with:
 * b = 0 - 7, r = A, B, C, D, E, H, L, (HL)
 *
 * Flags affected:
 * Z - Set if bit b of register r is 0.
 * N - Reset.
 * H - Set.
 * C - Not affected.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * BIT            b,A           CB 47     8
 * BIT            b,B           CB 40     8
 * BIT            b,C           CB 41     8
 * BIT            b,D           CB 42     8
 * BIT            b,E           CB 43     8
 * BIT            b,H           CB 44     8
 * BIT            b,L           CB 45     8
 * BIT            b,(HL)        CB 46     16
 */

function bit(cpu, b, n) {
    var r = n & 1 << b;

    cpu.f &= ~0xe0;
    if (r == 0) cpu.f |= FLAG_Z;
    cpu.f |= FLAG_H;

    return r;
}

var BIT_b_r = function BIT_b_r(b, r) {
    return function (cpu) {
        bit(cpu, b, cpu[r]);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x40] = ['BIT 0,B', BIT_b_r(0, 'b')];
$cb[0x41] = ['BIT 0,C', BIT_b_r(0, 'c')];
$cb[0x42] = ['BIT 0,D', BIT_b_r(0, 'd')];
$cb[0x43] = ['BIT 0,E', BIT_b_r(0, 'e')];
$cb[0x44] = ['BIT 0,H', BIT_b_r(0, 'h')];
$cb[0x45] = ['BIT 0,L', BIT_b_r(0, 'l')];
$cb[0x47] = ['BIT 0,A', BIT_b_r(0, 'a')];

$cb[0x48] = ['BIT 1,B', BIT_b_r(1, 'b')];
$cb[0x49] = ['BIT 1,C', BIT_b_r(1, 'c')];
$cb[0x4a] = ['BIT 1,D', BIT_b_r(1, 'd')];
$cb[0x4b] = ['BIT 1,E', BIT_b_r(1, 'e')];
$cb[0x4c] = ['BIT 1,H', BIT_b_r(1, 'h')];
$cb[0x4d] = ['BIT 1,L', BIT_b_r(1, 'l')];
$cb[0x4f] = ['BIT 1,A', BIT_b_r(1, 'a')];

$cb[0x50] = ['BIT 2,B', BIT_b_r(2, 'b')];
$cb[0x51] = ['BIT 2,C', BIT_b_r(2, 'c')];
$cb[0x52] = ['BIT 2,D', BIT_b_r(2, 'd')];
$cb[0x53] = ['BIT 2,E', BIT_b_r(2, 'e')];
$cb[0x54] = ['BIT 2,H', BIT_b_r(2, 'h')];
$cb[0x55] = ['BIT 2,L', BIT_b_r(2, 'l')];
$cb[0x57] = ['BIT 2,A', BIT_b_r(2, 'a')];

$cb[0x58] = ['BIT 3,B', BIT_b_r(3, 'b')];
$cb[0x59] = ['BIT 3,C', BIT_b_r(3, 'c')];
$cb[0x5a] = ['BIT 3,D', BIT_b_r(3, 'd')];
$cb[0x5b] = ['BIT 3,E', BIT_b_r(3, 'e')];
$cb[0x5c] = ['BIT 3,H', BIT_b_r(3, 'h')];
$cb[0x5d] = ['BIT 3,L', BIT_b_r(3, 'l')];
$cb[0x5f] = ['BIT 3,A', BIT_b_r(3, 'a')];

$cb[0x60] = ['BIT 4,B', BIT_b_r(4, 'b')];
$cb[0x61] = ['BIT 4,C', BIT_b_r(4, 'c')];
$cb[0x62] = ['BIT 4,D', BIT_b_r(4, 'd')];
$cb[0x63] = ['BIT 4,E', BIT_b_r(4, 'e')];
$cb[0x64] = ['BIT 4,H', BIT_b_r(4, 'h')];
$cb[0x65] = ['BIT 4,L', BIT_b_r(4, 'l')];
$cb[0x67] = ['BIT 4,A', BIT_b_r(4, 'a')];

$cb[0x68] = ['BIT 5,B', BIT_b_r(5, 'b')];
$cb[0x69] = ['BIT 5,C', BIT_b_r(5, 'c')];
$cb[0x6a] = ['BIT 5,D', BIT_b_r(5, 'd')];
$cb[0x6b] = ['BIT 5,E', BIT_b_r(5, 'e')];
$cb[0x6c] = ['BIT 5,H', BIT_b_r(5, 'h')];
$cb[0x6d] = ['BIT 5,L', BIT_b_r(5, 'l')];
$cb[0x6f] = ['BIT 5,A', BIT_b_r(5, 'a')];

$cb[0x70] = ['BIT 6,B', BIT_b_r(6, 'b')];
$cb[0x71] = ['BIT 6,C', BIT_b_r(6, 'c')];
$cb[0x72] = ['BIT 6,D', BIT_b_r(6, 'd')];
$cb[0x73] = ['BIT 6,E', BIT_b_r(6, 'e')];
$cb[0x74] = ['BIT 6,H', BIT_b_r(6, 'h')];
$cb[0x75] = ['BIT 6,L', BIT_b_r(6, 'l')];
$cb[0x77] = ['BIT 6,A', BIT_b_r(6, 'a')];

$cb[0x78] = ['BIT 7,B', BIT_b_r(7, 'b')];
$cb[0x79] = ['BIT 7,C', BIT_b_r(7, 'c')];
$cb[0x7a] = ['BIT 7,D', BIT_b_r(7, 'd')];
$cb[0x7b] = ['BIT 7,E', BIT_b_r(7, 'e')];
$cb[0x7c] = ['BIT 7,H', BIT_b_r(7, 'h')];
$cb[0x7d] = ['BIT 7,L', BIT_b_r(7, 'l')];
$cb[0x7f] = ['BIT 7,A', BIT_b_r(7, 'a')];

var BIT_b_$HL = function BIT_b_$HL(b) {
    return function (cpu, mmu) {
        bit(cpu, b, mmu.readByte(cpu.hl));
        cpu.pc += 2;

        return 16;
    };
};

$cb[0x46] = ['BIT 0,(HL)', BIT_b_$HL(0)];
$cb[0x4e] = ['BIT 1,(HL)', BIT_b_$HL(1)];
$cb[0x56] = ['BIT 2,(HL)', BIT_b_$HL(2)];
$cb[0x5e] = ['BIT 3,(HL)', BIT_b_$HL(3)];
$cb[0x66] = ['BIT 4,(HL)', BIT_b_$HL(4)];
$cb[0x6e] = ['BIT 5,(HL)', BIT_b_$HL(5)];
$cb[0x76] = ['BIT 6,(HL)', BIT_b_$HL(6)];
$cb[0x7e] = ['BIT 7,(HL)', BIT_b_$HL(7)];

/**
 * SET b,r
 *
 * Description:
 * Set bit b in register r.
 *
 * Use with:
 * b = 0 - 7, r = A, B, C, D, E, H, L, (HL)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * SET            b,A           CB C7     8
 * SET            b,B           CB C0     8
 * SET            b,C           CB C1     8
 * SET            b,D           CB C2     8
 * SET            b,E           CB C3     8
 * SET            b,H           CB C4     8
 * SET            b,L           CB C5     8
 * SET            b,(HL)        CB C6     16
 */

var SET_b_r = function SET_b_r(b, r) {
    return function (cpu) {
        cpu[r] |= 1 << b;
        cpu.pc += 2;

        return 8;
    };
};

$cb[0xc0] = ['SET 0,B', SET_b_r(0, 'b')];
$cb[0xc1] = ['SET 0,C', SET_b_r(0, 'c')];
$cb[0xc2] = ['SET 0,D', SET_b_r(0, 'd')];
$cb[0xc3] = ['SET 0,E', SET_b_r(0, 'e')];
$cb[0xc4] = ['SET 0,H', SET_b_r(0, 'h')];
$cb[0xc5] = ['SET 0,L', SET_b_r(0, 'l')];
$cb[0xc7] = ['SET 0,A', SET_b_r(0, 'a')];

$cb[0xc8] = ['SET 1,B', SET_b_r(1, 'b')];
$cb[0xc9] = ['SET 1,C', SET_b_r(1, 'c')];
$cb[0xca] = ['SET 1,D', SET_b_r(1, 'd')];
$cb[0xcb] = ['SET 1,E', SET_b_r(1, 'e')];
$cb[0xcc] = ['SET 1,H', SET_b_r(1, 'h')];
$cb[0xcd] = ['SET 1,L', SET_b_r(1, 'l')];
$cb[0xcf] = ['SET 1,A', SET_b_r(1, 'a')];

$cb[0xd0] = ['SET 2,B', SET_b_r(2, 'b')];
$cb[0xd1] = ['SET 2,C', SET_b_r(2, 'c')];
$cb[0xd2] = ['SET 2,D', SET_b_r(2, 'd')];
$cb[0xd3] = ['SET 2,E', SET_b_r(2, 'e')];
$cb[0xd4] = ['SET 2,H', SET_b_r(2, 'h')];
$cb[0xd5] = ['SET 2,L', SET_b_r(2, 'l')];
$cb[0xd7] = ['SET 2,A', SET_b_r(2, 'a')];

$cb[0xd8] = ['SET 3,B', SET_b_r(3, 'b')];
$cb[0xd9] = ['SET 3,C', SET_b_r(3, 'c')];
$cb[0xda] = ['SET 3,D', SET_b_r(3, 'd')];
$cb[0xdb] = ['SET 3,E', SET_b_r(3, 'e')];
$cb[0xdc] = ['SET 3,H', SET_b_r(3, 'h')];
$cb[0xdd] = ['SET 3,L', SET_b_r(3, 'l')];
$cb[0xdf] = ['SET 3,A', SET_b_r(3, 'a')];

$cb[0xe0] = ['SET 4,B', SET_b_r(4, 'b')];
$cb[0xe1] = ['SET 4,C', SET_b_r(4, 'c')];
$cb[0xe2] = ['SET 4,D', SET_b_r(4, 'd')];
$cb[0xe3] = ['SET 4,E', SET_b_r(4, 'e')];
$cb[0xe4] = ['SET 4,H', SET_b_r(4, 'h')];
$cb[0xe5] = ['SET 4,L', SET_b_r(4, 'l')];
$cb[0xe7] = ['SET 4,A', SET_b_r(4, 'a')];

$cb[0xe8] = ['SET 5,B', SET_b_r(5, 'b')];
$cb[0xe9] = ['SET 5,C', SET_b_r(5, 'c')];
$cb[0xea] = ['SET 5,D', SET_b_r(5, 'd')];
$cb[0xeb] = ['SET 5,E', SET_b_r(5, 'e')];
$cb[0xec] = ['SET 5,H', SET_b_r(5, 'h')];
$cb[0xed] = ['SET 5,L', SET_b_r(5, 'l')];
$cb[0xef] = ['SET 5,A', SET_b_r(5, 'a')];

$cb[0xf0] = ['SET 6,B', SET_b_r(6, 'b')];
$cb[0xf1] = ['SET 6,C', SET_b_r(6, 'c')];
$cb[0xf2] = ['SET 6,D', SET_b_r(6, 'd')];
$cb[0xf3] = ['SET 6,E', SET_b_r(6, 'e')];
$cb[0xf4] = ['SET 6,H', SET_b_r(6, 'h')];
$cb[0xf5] = ['SET 6,L', SET_b_r(6, 'l')];
$cb[0xf7] = ['SET 6,A', SET_b_r(6, 'a')];

$cb[0xf8] = ['SET 7,B', SET_b_r(7, 'b')];
$cb[0xf9] = ['SET 7,C', SET_b_r(7, 'c')];
$cb[0xfa] = ['SET 7,D', SET_b_r(7, 'd')];
$cb[0xfb] = ['SET 7,E', SET_b_r(7, 'e')];
$cb[0xfc] = ['SET 7,H', SET_b_r(7, 'h')];
$cb[0xfd] = ['SET 7,L', SET_b_r(7, 'l')];
$cb[0xff] = ['SET 7,A', SET_b_r(7, 'a')];

var SET_b_$HL = function SET_b_$HL(b) {
    return function (cpu, mmu) {
        mmu.writeByte(cpu.hl, mmu.readByte(cpu.hl) | 1 << b);
        cpu.pc += 2;

        return 16;
    };
};

$cb[0xc6] = ['SET 0,(HL)', SET_b_$HL(0)];
$cb[0xce] = ['SET 1,(HL)', SET_b_$HL(1)];
$cb[0xd6] = ['SET 2,(HL)', SET_b_$HL(2)];
$cb[0xde] = ['SET 3,(HL)', SET_b_$HL(3)];
$cb[0xe6] = ['SET 4,(HL)', SET_b_$HL(4)];
$cb[0xee] = ['SET 5,(HL)', SET_b_$HL(5)];
$cb[0xf6] = ['SET 6,(HL)', SET_b_$HL(6)];
$cb[0xfe] = ['SET 7,(HL)', SET_b_$HL(7)];

/**
 * RES b,r
 *
 * Description:
 * Reset bit b in register r.
 *
 * Use with:
 * b = 0 - 7, r = A, B, C, D, E, H, L, (HL)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RES            b,A           CB 87     8
 * RES            b,B           CB 80     8
 * RES            b,C           CB 81     8
 * RES            b,D           CB 82     8
 * RES            b,E           CB 83     8
 * RES            b,H           CB 84     8
 * RES            b,L           CB 85     8
 * RES            b,(HL)        CB 86     16
 */

var RES_b_r = function RES_b_r(b, r) {
    return function (cpu) {
        cpu[r] &= ~(1 << b);
        cpu.pc += 2;

        return 8;
    };
};

$cb[0x80] = ['RES 0,B', RES_b_r(0, 'b')];
$cb[0x81] = ['RES 0,C', RES_b_r(0, 'c')];
$cb[0x82] = ['RES 0,D', RES_b_r(0, 'd')];
$cb[0x83] = ['RES 0,E', RES_b_r(0, 'e')];
$cb[0x84] = ['RES 0,H', RES_b_r(0, 'h')];
$cb[0x85] = ['RES 0,L', RES_b_r(0, 'l')];
$cb[0x87] = ['RES 0,A', RES_b_r(0, 'a')];

$cb[0x88] = ['RES 1,B', RES_b_r(1, 'b')];
$cb[0x89] = ['RES 1,C', RES_b_r(1, 'c')];
$cb[0x8a] = ['RES 1,D', RES_b_r(1, 'd')];
$cb[0x8b] = ['RES 1,E', RES_b_r(1, 'e')];
$cb[0x8c] = ['RES 1,H', RES_b_r(1, 'h')];
$cb[0x8d] = ['RES 1,L', RES_b_r(1, 'l')];
$cb[0x8f] = ['RES 1,A', RES_b_r(1, 'a')];

$cb[0x90] = ['RES 2,B', RES_b_r(2, 'b')];
$cb[0x91] = ['RES 2,C', RES_b_r(2, 'c')];
$cb[0x92] = ['RES 2,D', RES_b_r(2, 'd')];
$cb[0x93] = ['RES 2,E', RES_b_r(2, 'e')];
$cb[0x94] = ['RES 2,H', RES_b_r(2, 'h')];
$cb[0x95] = ['RES 2,L', RES_b_r(2, 'l')];
$cb[0x97] = ['RES 2,A', RES_b_r(2, 'a')];

$cb[0x98] = ['RES 3,B', RES_b_r(3, 'b')];
$cb[0x99] = ['RES 3,C', RES_b_r(3, 'c')];
$cb[0x9a] = ['RES 3,D', RES_b_r(3, 'd')];
$cb[0x9b] = ['RES 3,E', RES_b_r(3, 'e')];
$cb[0x9c] = ['RES 3,H', RES_b_r(3, 'h')];
$cb[0x9d] = ['RES 3,L', RES_b_r(3, 'l')];
$cb[0x9f] = ['RES 3,A', RES_b_r(3, 'a')];

$cb[0xa0] = ['RES 4,B', RES_b_r(4, 'b')];
$cb[0xa1] = ['RES 4,C', RES_b_r(4, 'c')];
$cb[0xa2] = ['RES 4,D', RES_b_r(4, 'd')];
$cb[0xa3] = ['RES 4,E', RES_b_r(4, 'e')];
$cb[0xa4] = ['RES 4,H', RES_b_r(4, 'h')];
$cb[0xa5] = ['RES 4,L', RES_b_r(4, 'l')];
$cb[0xa7] = ['RES 4,A', RES_b_r(4, 'a')];

$cb[0xa8] = ['RES 5,B', RES_b_r(5, 'b')];
$cb[0xa9] = ['RES 5,C', RES_b_r(5, 'c')];
$cb[0xaa] = ['RES 5,D', RES_b_r(5, 'd')];
$cb[0xab] = ['RES 5,E', RES_b_r(5, 'e')];
$cb[0xac] = ['RES 5,H', RES_b_r(5, 'h')];
$cb[0xad] = ['RES 5,L', RES_b_r(5, 'l')];
$cb[0xaf] = ['RES 5,A', RES_b_r(5, 'a')];

$cb[0xb0] = ['RES 6,B', RES_b_r(6, 'b')];
$cb[0xb1] = ['RES 6,C', RES_b_r(6, 'c')];
$cb[0xb2] = ['RES 6,D', RES_b_r(6, 'd')];
$cb[0xb3] = ['RES 6,E', RES_b_r(6, 'e')];
$cb[0xb4] = ['RES 6,H', RES_b_r(6, 'h')];
$cb[0xb5] = ['RES 6,L', RES_b_r(6, 'l')];
$cb[0xb7] = ['RES 6,A', RES_b_r(6, 'a')];

$cb[0xb8] = ['RES 7,B', RES_b_r(7, 'b')];
$cb[0xb9] = ['RES 7,C', RES_b_r(7, 'c')];
$cb[0xba] = ['RES 7,D', RES_b_r(7, 'd')];
$cb[0xbb] = ['RES 7,E', RES_b_r(7, 'e')];
$cb[0xbc] = ['RES 7,H', RES_b_r(7, 'h')];
$cb[0xbd] = ['RES 7,L', RES_b_r(7, 'l')];
$cb[0xbf] = ['RES 7,A', RES_b_r(7, 'a')];

var RES_b_$HL = function RES_b_$HL(b) {
    return function (cpu, mmu) {
        mmu.writeByte(cpu.hl, mmu.readByte(cpu.hl) & ~(1 << b));
        cpu.pc += 2;

        return 16;
    };
};

$cb[0x86] = ['RES 0,(HL)', RES_b_$HL(0)];
$cb[0x8e] = ['RES 1,(HL)', RES_b_$HL(1)];
$cb[0x96] = ['RES 2,(HL)', RES_b_$HL(2)];
$cb[0x9e] = ['RES 3,(HL)', RES_b_$HL(3)];
$cb[0xa6] = ['RES 4,(HL)', RES_b_$HL(4)];
$cb[0xae] = ['RES 5,(HL)', RES_b_$HL(5)];
$cb[0xb6] = ['RES 6,(HL)', RES_b_$HL(6)];
$cb[0xbe] = ['RES 7,(HL)', RES_b_$HL(7)];

// Jumps

/**
 * JP nn
 *
 * Description:
 * Jump to address nn.
 *
 * Use with:
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * JP             nn            C3        12
 */

$[0xc3] = ['JP nn', function (cpu, mmu) {
    cpu.pc = mmu.readWord(cpu.pc + 1);

    return 16;
}];

/**
 * JP cc,nn
 *
 * Description:
 * Jump to address n if following condition is true:
 * cc = NZ, Jump if Z flag is reset.
 * cc = Z, Jump if Z flag is set.
 * cc = NC, Jump if C flag is reset.
 * cc = C, Jump if C flag is set.
 *
 * Use with:
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * JP             NZ,nn         C2        12
 * JP             Z,nn          CA        12
 * JP             NC,nn         D2        12
 * JP             C,nn          DA        12
 */

var JP_cc_nn = function JP_cc_nn(cpu, mmu, cc) {
    if (cc) {
        cpu.pc = mmu.readWord(cpu.pc + 1);
        return 16;
    }
    cpu.pc += 3;

    return 12;
};

$[0xc2] = ['JP NZ,nn', function (cpu, mmu) {
    return JP_cc_nn(cpu, mmu, !(cpu.f & FLAG_Z));
}];
$[0xd2] = ['JP NC,nn', function (cpu, mmu) {
    return JP_cc_nn(cpu, mmu, !(cpu.f & FLAG_C));
}];

$[0xca] = ['JP Z,nn', function (cpu, mmu) {
    return JP_cc_nn(cpu, mmu, cpu.f & FLAG_Z);
}];
$[0xda] = ['JP C,nn', function (cpu, mmu) {
    return JP_cc_nn(cpu, mmu, cpu.f & FLAG_C);
}];

/**
 * JP (HL)
 *
 * Description:
 * Jump to address contained in HL.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * JP             (HL)          E9        4
 */

$[0xe9] = ['JP (HL)', function (cpu) {
    cpu.pc = cpu.hl;

    return 4;
}];

/**
 * JR n
 *
 * Description:
 * Add n to current address and jump to it.
 *
 * Use with:
 * n = one byte signed immediate value
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * JR             n             18        8
 */

$[0x18] = ['JR n', function (cpu, mmu) {
    cpu.pc += 2 + mmu.readByte(cpu.pc + 1).signed();

    return 12;
}];

/**
 * JR cc,n
 *
 * Description:
 * If following condition is true then add n address and jump to it:
 *
 * Use with:
 * n = one byte signed immediate value
 * cc = NZ, Jump if Z flag is reset.
 * cc = Z, Jump if Z flag is set.
 * cc = NC, Jump if C flag is reset.
 * cc = C, Jump if C flag is set.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * JR             NZ,*          20        8
 * JR             Z,*           28        8
 * JR             NC,*          30        8
 * JR             C,*           38        8
 */

var JR_cc_n = function JR_cc_n(cpu, mmu, cc) {
    if (cc) {
        cpu.pc += 2 + mmu.readByte(cpu.pc + 1).signed();
        return 12;
    }
    cpu.pc += 2;

    return 8;
};

$[0x20] = ['JR NZ,n', function (cpu, mmu) {
    return JR_cc_n(cpu, mmu, !(cpu.f & FLAG_Z));
}];
$[0x30] = ['JR NC,n', function (cpu, mmu) {
    return JR_cc_n(cpu, mmu, !(cpu.f & FLAG_C));
}];

$[0x28] = ['JR Z,n', function (cpu, mmu) {
    return JR_cc_n(cpu, mmu, cpu.f & FLAG_Z);
}];
$[0x38] = ['JR C,n', function (cpu, mmu) {
    return JR_cc_n(cpu, mmu, cpu.f & FLAG_C);
}];

// Calls

/**
 * CALL nn
 *
 * Description:
 * Push address of next instruction onto stack and then jump to address nn.
 *
 * Use with:
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * CALL           nn            CD        12
 */

$[0xcd] = ['CALL nn', function (cpu, mmu) {
    mmu.writeWord(cpu.sp -= 2, cpu.pc + 3);
    cpu.pc = mmu.readWord(cpu.pc + 1);

    return 24;
}];

/**
 * CALL cc,nn
 *
 * Description:
 * Call address n if following condition is true:
 * cc = NZ, Call if Z flag is reset.
 * cc = Z, Call if Z flag is set.
 * cc = NC, Call if C flag is reset.
 * cc = C, Call if C flag is set.
 *
 * Use with:
 * nn = two byte immediate value. (LS byte first.)
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * CALL           NZ,nn         C4        12
 * CALL           Z,nn          CC        12
 * CALL           NC,nn         D4        12
 * CALL           C,nn          DC        12
 */

var CALL_cc_nn = function CALL_cc_nn(cpu, mmu, cc) {
    if (cc) {
        mmu.writeWord(cpu.sp -= 2, cpu.pc + 3);
        cpu.pc = mmu.readWord(cpu.pc + 1);

        return 24;
    }
    cpu.pc += 3;

    return 12;
};

$[0xc4] = ['CALL NZ,nn', function (cpu, mmu) {
    return CALL_cc_nn(cpu, mmu, !(cpu.f & FLAG_Z));
}];
$[0xd4] = ['CALL NC,nn', function (cpu, mmu) {
    return CALL_cc_nn(cpu, mmu, !(cpu.f & FLAG_C));
}];

$[0xcc] = ['CALL Z,nn', function (cpu, mmu) {
    return CALL_cc_nn(cpu, mmu, cpu.f & FLAG_Z);
}];
$[0xdc] = ['CALL C,nn', function (cpu, mmu) {
    return CALL_cc_nn(cpu, mmu, cpu.f & FLAG_C);
}];

// Restarts

/**
 * RST n
 *
 * Description:
 * Push present address onto stack. Jump to address $0000 + n.
 *
 * Use with:
 * n = $00, $08, $10, $18, $20, $28, $30, $38
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RST            00H           C7        32
 * RST            08H           CF        32
 * RST            10H           D7        32
 * RST            08H           DF        32
 * RST            20H           E7        32
 * RST            28H           EF        32
 * RST            30H           F7        32
 * RST            38H           FF        32
 */

var RST_n = function RST_n(n) {
    return function (cpu, mmu) {
        mmu.writeWord(cpu.sp -= 2, cpu.pc + 1);
        cpu.pc = n;

        return 16;
    };
};

$[0xc7] = ['RST 00H', RST_n(0x00)];
$[0xcf] = ['RST 08H', RST_n(0x08)];
$[0xd7] = ['RST 10H', RST_n(0x10)];
$[0xdf] = ['RST 18H', RST_n(0x18)];
$[0xe7] = ['RST 20H', RST_n(0x20)];
$[0xef] = ['RST 28H', RST_n(0x28)];
$[0xf7] = ['RST 30H', RST_n(0x30)];
$[0xff] = ['RST 38H', RST_n(0x38)];

// Returns

/**
 * RET
 *
 * Description:
 * Pop two bytes from stack & jump to that address.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RET            - / -         C9        8
 */

$[0xc9] = ['RET', function (cpu, mmu) {
    cpu.pc = mmu.readWord(cpu.sp);
    cpu.sp += 2;

    return 16;
}];

/**
 * RET cc
 *
 * Description:
 * Return if following condition is true:
 *
 * Use with:
 * cc = NZ, Return if Z flag is reset.
 * cc = Z, Return if Z flag is set.
 * cc = NC, Return if C flag is reset.
 * cc = C, Return if C flag is set.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RET            NZ            C0        8
 * RET            Z             C8        8
 * RET            NC            D0        8
 * RET            C             D8        8
 */

var RET_cc = function RET_cc(cpu, mmu, cc) {
    if (cc) {
        cpu.pc = mmu.readWord(cpu.sp);
        cpu.sp += 2;

        return 20;
    }
    cpu.pc += 1;

    return 8;
};

$[0xc0] = ['RET NZ', function (cpu, mmu) {
    return RET_cc(cpu, mmu, !(cpu.f & FLAG_Z));
}];
$[0xd0] = ['RET NC', function (cpu, mmu) {
    return RET_cc(cpu, mmu, !(cpu.f & FLAG_C));
}];

$[0xc8] = ['RET Z', function (cpu, mmu) {
    return RET_cc(cpu, mmu, cpu.f & FLAG_Z);
}];
$[0xd8] = ['RET C', function (cpu, mmu) {
    return RET_cc(cpu, mmu, cpu.f & FLAG_C);
}];

/**
 * RETI
 *
 * Description:
 * Pop two bytes from stack & jump to that address then enable interrupts.
 *
 * Opcodes:
 * Instruction    Parameters    Opcode    Cycles
 * RETI           - / -         D9        8
 */

$[0xd9] = ['RETI', function (cpu, mmu) {
    cpu.pc = mmu.readWord(cpu.sp);
    cpu.sp += 2;
    cpu.ime = true;

    return 16;
}];

},{"../util/number":15}],3:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _step = require('debug')('gameboy:timer:step');
var divider = require('debug')('gameboy:timer:divider');
var counter = require('debug')('gameboy:timer:counter');
var Serializable = require('../util/serializable');

var _require = require('../registers'),
    DIV = _require.DIV,
    TIMA = _require.TIMA,
    TMA = _require.TMA,
    TAC = _require.TAC;

var _require2 = require('../interrupts'),
    INT_50 = _require2.INT_50;

var MAX_DIVIDER = 16384;

// Timer Clock Select

var CLOCK_SELECT = [];

CLOCK_SELECT[0] = 4096; // 00: CPU Clock / 1024
CLOCK_SELECT[1] = 262144; // 01: CPU Clock / 16
CLOCK_SELECT[2] = 65536; // 10: CPU Clock / 64
CLOCK_SELECT[3] = 16384; // 11: CPU Clock / 256


var Timer = function (_Serializable) {
    _inherits(Timer, _Serializable);

    function Timer(mmu) {
        _classCallCheck(this, Timer);

        var _this = _possibleConstructorReturn(this, (Timer.__proto__ || Object.getPrototypeOf(Timer)).call(this));

        _this._mmu = mmu;

        // Registers

        _this._div = 0;
        _this._tima = 0;
        _this._tma = 0;
        _this._tac = 0;

        // Timers

        _this._divider = MAX_DIVIDER;
        _this._t = CLOCK_SELECT[0];
        return _this;
    }

    _createClass(Timer, [{
        key: 'init',
        value: function init() {
            this._div = 0;
            this._tima = 0;
            this._tma = 0;
            this._tac = 0;

            this._divider = MAX_DIVIDER;
            this._t = CLOCK_SELECT[0];
        }
    }, {
        key: 'step',
        value: function step(cycles) {
            _step('%d', cycles);

            // Divider

            this._divider -= cycles;
            if (this._divider <= 0) {
                this._div = ++this._div & 0xff;
                divider('0x%s', this._div.toString(16));

                this._divider += MAX_DIVIDER;
            }

            // Timer

            if ((this._tac & 4) == 0) return;

            this._t -= cycles;
            if (this._t > 0) return;

            this._tima = ++this._tima & 0xff;
            if (this._tima == 0) {
                this._tima = this._tma;
                this._mmu.if |= INT_50;
            }
            counter('0x%s', this._tima.toString(16));

            this._t += CLOCK_SELECT[this._tac & 3];
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            switch (addr) {
                case DIV:
                    return this._div;
                case TIMA:
                    return this._tima;
                case TMA:
                    return this._tma;
                case TAC:
                    return this._tac;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            switch (addr) {
                case DIV:
                    return this._div = 0;
                case TIMA:
                    return this._tima = val;
                case TMA:
                    return this._tma = val;
                case TAC:
                    return this._tac = val;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }]);

    return Timer;
}(Serializable({ exclude: ['_mmu'] }));

module.exports = Timer;

},{"../interrupts":8,"../registers":12,"../util/serializable":16,"debug":14}],4:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Video = require('./gpu/video');
var Timer = require('./cpu/timer');
var Lcd = require('./gpu/lcd');
var Mmu = require('./mmu');
var Gpu = require('./gpu/gpu');
var Cpu = require('./cpu/cpu');
var Joypad = require('./io/joypad');
var Serializable = require('./util/serializable');

var exclude = ['_joypad', '_useBios', '_isRunning'];

var Gameboy = function (_Serializable) {
    _inherits(Gameboy, _Serializable);

    function Gameboy(bios) {
        _classCallCheck(this, Gameboy);

        var _this = _possibleConstructorReturn(this, (Gameboy.__proto__ || Object.getPrototypeOf(Gameboy)).call(this));

        var mmu = new Mmu(bios);

        var video = new Video();
        var gpu = new Gpu(video);
        var timer = new Timer(mmu);
        var lcd = new Lcd(mmu, gpu);
        var cpu = new Cpu(mmu, timer, lcd);
        var joypad = new Joypad(mmu);

        _this._video = video;
        _this._timer = timer;
        _this._lcd = lcd;
        _this._mmu = mmu;
        _this._gpu = gpu;
        _this._cpu = cpu;
        _this._joypad = joypad;

        // Mappings

        mmu.video = video;
        mmu.timer = timer;
        mmu.lcd = lcd;
        mmu.gpu = gpu;
        mmu.joypad = joypad;

        // Use Bootstrap

        _this._useBios = bios && bios.length > 0;

        // Gameloop

        _this._isRunning = false;
        return _this;
    }

    _createClass(Gameboy, [{
        key: 'loadCart',
        value: function loadCart(rom) {
            this._isRunning = false;
            this._cpu.stop();
            this._mmu.loadCart(rom);
        }
    }, {
        key: 'start',
        value: function start() {
            this._isRunning = true;
            this._init();
            this._cpu.start();
        }
    }, {
        key: 'pauseResume',
        value: function pauseResume() {
            this._isRunning = !this._isRunning;
            if (this._isRunning) this._cpu.start();else this._cpu.stop();
        }
    }, {
        key: 'reset',
        value: function reset() {
            this._isRunning = false;
            this._cpu.stop();
            this.start();
        }
    }, {
        key: '_init',
        value: function _init() {
            this._timer.init();
            this._lcd.init();
            this._mmu.init();
            this._cpu.init();

            if (!this._useBios) {
                this._cpu.pc = 0x100;
                this._cpu.af = 0x1b0;
                this._cpu.bc = 0x13;
                this._cpu.de = 0xd8;
                this._cpu.hl = 0x14d;
                this._cpu.sp = 0xfffe;

                this._mmu.writeByte(0xff05, 0x00); // TIMA
                this._mmu.writeByte(0xff06, 0x00); // TMA
                this._mmu.writeByte(0xff07, 0x00); // TAC
                this._mmu.writeByte(0xff10, 0x80); // NR10
                this._mmu.writeByte(0xff11, 0xbf); // NR11
                this._mmu.writeByte(0xff12, 0xf3); // NR12
                this._mmu.writeByte(0xff14, 0xbf); // NR14
                this._mmu.writeByte(0xff16, 0x3f); // NR21
                this._mmu.writeByte(0xff17, 0x00); // NR22
                this._mmu.writeByte(0xff19, 0xbf); // NR24
                this._mmu.writeByte(0xff1a, 0x7f); // NR30
                this._mmu.writeByte(0xff1b, 0xff); // NR31
                this._mmu.writeByte(0xff1c, 0x9f); // NR32
                this._mmu.writeByte(0xff1e, 0xbf); // NR33
                this._mmu.writeByte(0xff20, 0xff); // NR41
                this._mmu.writeByte(0xff21, 0x00); // NR42
                this._mmu.writeByte(0xff22, 0x00); // NR43
                this._mmu.writeByte(0xff23, 0xbf); // NR30
                this._mmu.writeByte(0xff24, 0x77); // NR50
                this._mmu.writeByte(0xff25, 0xf3); // NR51
                this._mmu.writeByte(0xff26, 0xf1); // NR52
                this._mmu.writeByte(0xff40, 0x91); // LCDC
                this._mmu.writeByte(0xff42, 0x00); // SCY
                this._mmu.writeByte(0xff43, 0x00); // SCX
                this._mmu.writeByte(0xff45, 0x00); // LYC
                this._mmu.writeByte(0xff47, 0xfc); // BGP
                this._mmu.writeByte(0xff48, 0xff); // OBP0
                this._mmu.writeByte(0xff49, 0xff); // OBP1
                this._mmu.writeByte(0xff4a, 0x00); // WY
                this._mmu.writeByte(0xff4b, 0x00); // WX
                this._mmu.writeByte(0xffff, 0x00); // IE
            }
        }
    }, {
        key: 'gpu',
        get: function get() {
            return this._gpu;
        }
    }, {
        key: 'joypad',
        get: function get() {
            return this._joypad;
        }
    }]);

    return Gameboy;
}(Serializable({ exclude: exclude }));

module.exports = Gameboy;

},{"./cpu/cpu":1,"./cpu/timer":3,"./gpu/gpu":5,"./gpu/lcd":6,"./gpu/video":7,"./io/joypad":10,"./mmu":11,"./util/serializable":16}],5:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _render = require('debug')('gameboy:gpu:render');
var control = require('debug')('gameboy:gpu:control');
var EventEmitter = require('events').EventEmitter;
var Canvas = require('../shims/canvas');
var Serializable = require('../util/serializable');

var _require = require('../registers'),
    LCDC = _require.LCDC,
    SCY = _require.SCY,
    SCX = _require.SCX,
    WY = _require.WY,
    WX = _require.WX,
    BGP = _require.BGP,
    OBP0 = _require.OBP0,
    OBP1 = _require.OBP1;

require('../util/number');

// Non CGB gray shades

var GRAY_SHADES = [];

GRAY_SHADES[0] = [145, 149, 15];
GRAY_SHADES[1] = [105, 141, 87];
GRAY_SHADES[2] = [68, 110, 90];
GRAY_SHADES[3] = [54, 86, 76];

var FRAME_WIDTH = 160;
var FRAME_HEIGHT = 144;

var MAX_SPRITES = 10;

var include = ['_lcdc', '_scy', '_scx', '_wy', '_wx', '_bgp', '_obp0', '_obp1'];

var Gpu = function (_Serializable) {
    _inherits(Gpu, _Serializable);

    function Gpu(video) {
        _classCallCheck(this, Gpu);

        var _this = _possibleConstructorReturn(this, (Gpu.__proto__ || Object.getPrototypeOf(Gpu)).call(this));

        _this._video = video;

        // Registers

        _this._lcdc = 0;
        _this._scy = 0;
        _this._scx = 0;
        _this._wy = 0;
        _this._wx = 0;
        _this._bgp = 0;
        _this._obp0 = 0;
        _this._obp1 = 0;

        // Display

        _this._bgpal = null;
        _this._objpal = [];

        // Canvas

        _this._canvas = new Canvas(FRAME_WIDTH, FRAME_HEIGHT);
        _this._ctx = _this._canvas.getContext('2d');
        _this._image = _this._ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
        _this._data = _this._image.data;
        return _this;
    }

    _createClass(Gpu, [{
        key: 'fromJSON',
        value: function fromJSON(obj) {
            _get(Gpu.prototype.__proto__ || Object.getPrototypeOf(Gpu.prototype), 'fromJSON', this).call(this, obj);

            this._bgpal = this._createPalette(obj._bgp);
            this._objpal[0] = this._createPalette(obj._obp0);
            this._objpal[1] = this._createPalette(obj._obp1);
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            switch (addr) {
                case LCDC:
                    return this._lcdc;
                case SCY:
                    return this._scy;
                case SCX:
                    return this._scx;
                case BGP:
                    return this._bgp;
                case OBP0:
                    return this._obp0;
                case OBP1:
                    return this._obp1;
                case WY:
                    return this._wy;
                case WX:
                    return this._wx;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            switch (addr) {
                case LCDC:
                    return this._lcdc = val;
                case SCY:
                    return this._scy = val;
                case SCX:
                    return this._scx = val;
                case BGP:
                    this._bgpal = this._createPalette(val);
                    return this._bgp = val;
                case OBP0:
                    this._objpal[0] = this._createPalette(val);
                    return this._obp0 = val;
                case OBP1:
                    this._objpal[1] = this._createPalette(val);
                    return this._obp1 = val;
                case WY:
                    return this._wy = val;
                case WX:
                    return this._wx = val;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'drawLine',
        value: function drawLine(line) {
            var data = this._lcdc >> 4 & 1;

            // Background

            if (this._lcdc & 1) {
                var map = this._lcdc >> 3 & 1;
                this._drawBackground(line, this._scx, this._scy, map, data);
            }

            // Window

            if (this._lcdc & 0x20 && line >= this._wy) {
                var _map = this._lcdc >> 6 & 1;
                this._drawWindow(line, this._wx - 7, this._wy, _map, data);
            }

            // Sprites

            if (this._lcdc & 2) {
                this._drawSprites(line);
            }
        }
    }, {
        key: 'render',
        value: function render() {
            _render('frame');

            // LCD Display Enable

            control('%s', this._lcdc.toString(2));

            if (this._lcdc & 0x80 == 0) {
                this._ctx.fillStyle = 'white';
                this._ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
            }

            this._ctx.putImageData(this._image, 0, 0);
            this._ctx.drawImage(this._canvas, 0, 0);

            this.emit('frame', this._canvas);
        }
    }, {
        key: '_createPalette',
        value: function _createPalette(palette) {
            return [GRAY_SHADES[palette & 3], GRAY_SHADES[palette >> 2 & 3], GRAY_SHADES[palette >> 4 & 3], GRAY_SHADES[palette >> 6 & 3]];
        }
    }, {
        key: '_drawBackground',
        value: function _drawBackground(line, offsetX, offsetY, mapSelect, dataSelect) {
            var map = this._video.bgMap[mapSelect];
            var y = offsetY + line;

            for (var i = 0; i < FRAME_WIDTH; i++) {
                var x = offsetX + i;

                var col = (x & 0xff) >> 3;
                var row = (y & 0xff) >> 3;

                var n = map[row * 32 + col];
                var tile = this._video.tiles[dataSelect ? n : 256 + n.signed()];
                var shade = this._bgpal[tile[y & 7][x & 7]];

                var offset = (line * FRAME_WIDTH + i) * 4;

                this._data[offset] = shade[0];
                this._data[++offset] = shade[1];
                this._data[++offset] = shade[2];
                this._data[++offset] = 255;
            }
        }
    }, {
        key: '_drawWindow',
        value: function _drawWindow(line, posX, posY, mapSelect, dataSelect) {
            var map = this._video.bgMap[mapSelect];
            var y = line - posY;

            for (var i = posX; i < FRAME_WIDTH; i++) {
                var x = i - posX;

                var col = x >> 3;
                var row = y >> 3;

                var n = map[row * 32 + col];
                var tile = this._video.tiles[dataSelect ? n : 256 + n.signed()];
                var shade = this._bgpal[tile[y & 7][x & 7]];

                var offset = (line * FRAME_WIDTH + i) * 4;

                this._data[offset] = shade[0];
                this._data[++offset] = shade[1];
                this._data[++offset] = shade[2];
                this._data[++offset] = 255;
            }
        }
    }, {
        key: '_drawSprites',
        value: function _drawSprites(line) {
            var height = this._lcdc & 4 ? 16 : 8;
            var sprites = this._video.sprites.filter(function (sprite) {
                var sy = sprite[0] - 16;
                return line >= sy && line < sy + height;
            }).filter(function (sprite) {
                return sprite[1] - 8 < FRAME_WIDTH;
            }).slice(0, MAX_SPRITES);

            for (var i = sprites.length - 1; i > -1; i--) {
                var sprite = sprites[i];

                // Attributes/Flags

                var attrs = sprite[3];

                var priority = attrs >> 7 & 1;
                if (priority) continue;

                var yflip = attrs >> 6 & 1;
                var xflip = attrs >> 5 & 1;
                var palette = this._objpal[attrs >> 4 & 1];

                // Position

                var sy = sprite[0] - 16;
                var sx = sprite[1] - 8;

                // Tile/Pattern Number

                var n = this._lcdc & 4 ? sprite[2] & 0xfe : sprite[2];

                // Draw

                var py = yflip ? height - 1 - (line - sy) : line - sy;
                var data = this._data;

                for (var x = sx; x < sx + 8 && x < FRAME_WIDTH; x++) {
                    if (x < 0) continue;

                    var offset = (line * FRAME_WIDTH + x) * 4;

                    var tile = this._video.tiles[n + (py >> 3 & 1)];
                    var color = tile[py & 7][xflip ? 7 - (x - sx) : x - sx];
                    if (color == 0) continue;

                    var shade = palette[color];

                    data[offset + 0] = shade[0];
                    data[offset + 1] = shade[1];
                    data[offset + 2] = shade[2];
                    data[offset + 3] = 255;
                }
            };
        }
    }]);

    return Gpu;
}(Serializable({ include: include }, EventEmitter));

module.exports = Gpu;

},{"../registers":12,"../shims/canvas":13,"../util/number":15,"../util/serializable":16,"debug":14,"events":18}],6:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _step = require('debug')('gameboy:lcd:step');
var stat = require('debug')('gameboy:lcd:stat');
var Serializable = require('../util/serializable');

var _require = require('../registers'),
    STAT = _require.STAT,
    LY = _require.LY,
    LYC = _require.LYC;

var _require2 = require('../interrupts'),
    INT_40 = _require2.INT_40,
    INT_48 = _require2.INT_48;

var Lcd = function (_Serializable) {
    _inherits(Lcd, _Serializable);

    function Lcd(mmu, gpu) {
        _classCallCheck(this, Lcd);

        var _this = _possibleConstructorReturn(this, (Lcd.__proto__ || Object.getPrototypeOf(Lcd)).call(this));

        _this._mmu = mmu;
        _this._gpu = gpu;

        // Registers

        _this._stat = 0;
        _this._ly = 0;
        _this._lyc = 0;

        // Timer

        _this._t = 0;
        return _this;
    }

    _createClass(Lcd, [{
        key: 'init',
        value: function init() {
            this._stat = 0;
            this._ly = 0;
            this._lyc = 0;

            this._t = 0;
        }
    }, {
        key: 'step',
        value: function step(cycles) {
            _step('%d', cycles);

            this._t += cycles;

            /**
             * Mode Flag
             *
             * The two lower STAT bits show the current status of the LCD
             * controller.
             *
             * Mode 0: The LCD controller is in the H-Blank period and
             *         the CPU can access both the display RAM (8000h-9FFFh)
             *         and OAM (FE00h-FE9Fh)
             *
             * Mode 1: The LCD contoller is in the V-Blank period (or the
             *         display is disabled) and the CPU can access both the
             *         display RAM (8000h-9FFFh) and OAM (FE00h-FE9Fh)
             *
             * Mode 2: The LCD controller is reading from OAM memory.
             *         The CPU <cannot> access OAM memory (FE00h-FE9Fh)
             *         during this period.
             *
             * Mode 3: The LCD controller is reading from both OAM and VRAM,
             *         The CPU <cannot> access OAM and VRAM during this period.
             *         CGB Mode: Cannot access Palette Data (FF69,FF6B) either.
             *
             * The following are typical when the display is enabled:
             * Mode 2  2_____2_____2_____2_____2_____2___________________2____
             * Mode 3  _33____33____33____33____33____33__________________3___
             * Mode 0  ___000___000___000___000___000___000________________000
             * Mode 1  ____________________________________11111111111111_____
             *
             * The Mode Flag goes through the values 0, 2, and 3 at a cycle of
             * about 109uS. 0 is present about 48.6uS, 2 about 19uS, and 3 about
             * 41uS. This is interrupted every 16.6ms by the VBlank (1). The mode
             * flag stays set at 1 for about 1.08 ms.
             *
             * Mode 0 is present between 201-207 clks, 2 about 77-83 clks, and 3
             * about 169-175 clks. A complete cycle through these states takes 456
             * clks. VBlank lasts 4560 clks. A complete screen refresh occurs every
             * 70224 clks.)
             */

            var mode = this._stat & 3;

            switch (mode) {
                case 2:
                    if (this._t >= 80) {
                        this._t -= 80;
                        this._changeMode(3);
                    }
                    break;
                case 3:
                    if (this._t >= 172) {
                        this._t -= 172;
                        this._changeMode(0);
                        this._gpu.drawLine(this._ly);
                    }
                    break;
                case 0:
                    if (this._t >= 204) {
                        this._t -= 204;
                        this._ly++;
                        this._checkCoincidence();

                        if (this._ly == 144) {
                            this._changeMode(1);
                            this._mmu.if |= INT_40;
                            this._gpu.render();
                        } else this._changeMode(2);
                    }
                    break;
                case 1:
                    if (this._t >= 456) {
                        this._t -= 456;
                        this._ly++;

                        if (this._ly > 153) {
                            this._ly = 0;
                            this._changeMode(2);
                        }
                        this._checkCoincidence();
                    }
                    break;
            }

            stat('mode=%d; ly=%d', this._stat & 3, this._ly);
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            switch (addr) {
                case STAT:
                    return this._stat;
                case LY:
                    return this._ly;
                case LYC:
                    return this._lyc;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            switch (addr) {
                case STAT:
                    return this._stat = this._stat & ~0x78 | val & 0xf8;
                case LY:
                    return this._ly = 0;
                case LYC:
                    return this._lyc = val;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: '_changeMode',
        value: function _changeMode(mode) {
            var intf = false;

            switch (mode) {
                case 0:
                    if (this._stat & 8) intf = true;break;
                case 1:
                    if (this._stat & 0x10) intf = true;break;
                case 2:
                    if (this._stat & 0x20) intf = true;break;
            }
            if (intf) this._mmu.if |= INT_48;

            this._stat = this._stat & ~3 | mode;
        }
    }, {
        key: '_checkCoincidence',
        value: function _checkCoincidence() {
            if (this._lyc == this._ly) {
                this._stat |= 1 << 2;
                if (this._stat & 0x40) this._mmu.if |= INT_48;
            } else this._stat &= ~(1 << 2);
        }
    }]);

    return Lcd;
}(Serializable({ exclude: ['_mmu', '_gpu'] }));

module.exports = Lcd;

},{"../interrupts":8,"../registers":12,"../util/serializable":16,"debug":14}],7:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var dma = require('debug')('gameboy:video:dma');
var Serializable = require('../util/serializable');

var Video = function (_Serializable) {
    _inherits(Video, _Serializable);

    function Video() {
        _classCallCheck(this, Video);

        var _this = _possibleConstructorReturn(this, (Video.__proto__ || Object.getPrototypeOf(Video)).call(this));

        _this._ram = new Uint8Array(0x2000);
        _this._oam = new Uint8Array(0xa0);

        _this.bgMap = [new Array(0x400).fill(0), new Array(0x400).fill(0)];
        _this.tiles = _this._initTiles(32 * 32);
        _this.sprites = _this._initSprites(40);
        return _this;
    }

    _createClass(Video, [{
        key: 'fromJSON',
        value: function fromJSON(obj) {
            var _this2 = this;

            _get(Video.prototype.__proto__ || Object.getPrototypeOf(Video.prototype), 'fromJSON', this).call(this, obj);

            this._ram = new Uint8Array(obj._ram);
            this._oam = new Uint8Array(obj._oam);

            this._ram.forEach(function (v, i) {
                return _this2.writeByte(0x8000 + i, v);
            });
            this._oam.forEach(function (v, i) {
                return _this2.writeByte(0xfe00 + i, v);
            });
        }
    }, {
        key: 'transfer',
        value: function transfer(mmu, val) {
            var start = (val & 0xff) << 8;

            dma('transfer from 0x%s', start.toString(16));

            for (var addr = start; addr < start + 0xa0; addr++) {
                var data = mmu.readByte(addr);
                var pos = addr & 0xff;

                dma('copy $%s = 0x%s', addr.toString(16), data.toString(16));

                this.sprites[pos >> 2][pos & 3] = data;
                this._oam[pos] = data;
            }
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            switch (addr >> 12) {
                case 0x8:case 0x9:
                    return this._ram[addr & 0x1fff];
                case 0xf:
                    if (addr > 0xfe9f) break;
                    if (addr > 0xfdff) return this._oam[addr & 0xff];
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            switch (addr >> 12) {
                case 0x8:case 0x9:
                    if (addr > 0x97ff) {
                        this.bgMap[addr >> 10 & 1][addr & 0x3ff] = val;
                    } else {
                        var pos = addr & 0x1fff;
                        var res = this._sumBytes(this._ram[pos - 1], val);
                        this.tiles[pos >> 4][pos >> 1 & 7] = res;
                    }
                    return this._ram[addr & 0x1fff] = val;
                case 0xf:
                    if (addr > 0xfe9f) break;
                    if (addr > 0xfdff) {
                        var _pos = addr & 0xff;
                        this.sprites[_pos >> 2][_pos & 3] = val;
                        return this._oam[_pos] = val;
                    }
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: '_initTiles',
        value: function _initTiles(length) {
            var tiles = [];
            for (var i = 0; i < length; i++) {
                tiles[i] = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]];
            }return tiles;
        }
    }, {
        key: '_initSprites',
        value: function _initSprites(length) {
            var sprites = [];
            for (var i = 0; i < length; i++) {
                sprites[i] = [0, 0, 0, 0];
            }return sprites;
        }
    }, {
        key: '_sumBytes',
        value: function _sumBytes(x, y) {
            var line = [];
            for (var b = 7; b > -1; b--) {
                var val = x >> b & 1 | (y >> b & 1) << 1;
                line[7 - b] = val;
            }

            return line;
        }
    }]);

    return Video;
}(Serializable());

module.exports = Video;

},{"../util/serializable":16,"debug":14}],8:[function(require,module,exports){
'use strict';

/**
 * INT 40 - V-Blank Interrupt
 *
 * The V-Blank interrupt occurs ca. 59.7 times a second on a regular GB and ca.
 * 61.1 times a second on a Super GB (SGB). This interrupt occurs at the
 * beginning of the V-Blank period (LY=144).
 * During this period video hardware is not using video ram so it may be freely
 * accessed. This period lasts approximately 1.1 milliseconds.
 */

exports.INT_40 = 1;

/**
 * INT 48 - LCDC Status Interrupt
 *
 * There are various reasons for this interrupt to occur as described by the
 * STAT register ($FF40). One very popular reason is to indicate to the user
 * when the video hardware is about to redraw a given LCD line. This can be
 * useful for dynamically controlling the SCX/SCY registers ($FF43/$FF42) to
 * perform special video effects.
 */
exports.INT_48 = 1 << 1;

/**
 * INT 50 - Timer Interrupt
 *
 * Each time when the timer overflows (ie. when TIMA gets bigger than FFh), then
 * an interrupt is requested by setting Bit 2 in the IF Register (FF0F). When
 * that interrupt is enabled, then the CPU will execute it by calling the timer
 * interrupt vector at 0050h.
 */
exports.INT_50 = 1 << 2;

/**
 * INT 58 - Serial Interrupt
 *
 * When the transfer has completed (ie. after sending/receiving 8 bits, if any)
 * then an interrupt is requested by setting Bit 3 of the IF Register (FF0F).
 * When that interrupt is enabled, then the Serial Interrupt vector at 0058 is
 * called.
 */
exports.INT_58 = 1 << 3;

/**
 * INT 60 - Joypad Interrupt
 *
 * Joypad interrupt is requested when any of the above Input lines changes from
 * High to Low. Generally this should happen when a key becomes pressed
 * (provided that the button/direction key is enabled by above Bit4/5), however,
 * because of switch bounce, one or more High to Low transitions are usually
 * produced both when pressing or releasing a key.
 */
exports.INT_60 = 1 << 4;

},{}],9:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Serializable = require('../util/serializable');

/**
 * 0147 - Cartridge Type
 *
 * Specifies which Memory Bank Controller (if any) is used in the cartridge,
 * and if further external hardware exists in the cartridge.
 *
 * 00h  ROM ONLY                 13h  MBC3+RAM+BATTERY
 * 01h  MBC1                     15h  MBC4
 * 02h  MBC1+RAM                 16h  MBC4+RAM
 * 03h  MBC1+RAM+BATTERY         17h  MBC4+RAM+BATTERY
 * 05h  MBC2                     19h  MBC5
 * 06h  MBC2+BATTERY             1Ah  MBC5+RAM
 * 08h  ROM+RAM                  1Bh  MBC5+RAM+BATTERY
 * 09h  ROM+RAM+BATTERY          1Ch  MBC5+RUMBLE
 * 0Bh  MMM01                    1Dh  MBC5+RUMBLE+RAM
 * 0Ch  MMM01+RAM                1Eh  MBC5+RUMBLE+RAM+BATTERY
 * 0Dh  MMM01+RAM+BATTERY        FCh  POCKET CAMERA
 * 0Fh  MBC3+TIMER+BATTERY       FDh  BANDAI TAMA5
 * 10h  MBC3+TIMER+RAM+BATTERY   FEh  HuC3
 * 11h  MBC3
 */

var CART_TYPE = [];

CART_TYPE[0x00] = 'ROM ONLY';
CART_TYPE[0x01] = 'MBC1';
CART_TYPE[0x02] = 'MBC1+RAM';
CART_TYPE[0x03] = 'MBC1+RAM+BATTERY';
CART_TYPE[0x05] = 'MBC2';
CART_TYPE[0x06] = 'MBC2+BATTERY';

/**
 * 0148 - ROM Size
 *
 * Specifies the ROM Size of the cartridge. Typically calculated as
 * "32KB shl N".
 *
 * 00h -  32KByte (no ROM banking)
 * 01h -  64KByte (4 banks)
 * 02h - 128KByte (8 banks)
 * 03h - 256KByte (16 banks)
 * 04h - 512KByte (32 banks)
 * 05h -   1MByte (64 banks)  - only 63 banks used by MBC1
 * 06h -   2MByte (128 banks) - only 125 banks used by MBC1
 * 07h -   4MByte (256 banks)
 * 52h - 1.1MByte (72 banks)
 * 53h - 1.2MByte (80 banks)
 * 54h - 1.5MByte (96 banks)
 */

var ROM_SIZE = [];

ROM_SIZE[0x00] = 1;
ROM_SIZE[0x01] = 2;
ROM_SIZE[0x02] = 4;
ROM_SIZE[0x03] = 8;
ROM_SIZE[0x04] = 16;

/**
 * 0149 - RAM Size
 *
 * Specifies the size of the external RAM in the cartridge (if any).
 *
 * 00h - None
 * 01h - 2 KBytes
 * 02h - 8 Kbytes
 * 03h - 32 KBytes (4 banks of 8KBytes each)
 *
 * When using a MBC2 chip 00h must be specified in this entry, even though the
 * MBC2 includes a built-in RAM of 512 x 4 bits
 */

var RAM_SIZE = [];

RAM_SIZE[0x00] = 0;
RAM_SIZE[0x01] = 1;
RAM_SIZE[0x02] = 4;
RAM_SIZE[0x03] = 16;

var Cart = function (_Serializable) {
    _inherits(Cart, _Serializable);

    function Cart(rom) {
        _classCallCheck(this, Cart);

        var _this = _possibleConstructorReturn(this, (Cart.__proto__ || Object.getPrototypeOf(Cart)).call(this));

        var data = new Uint8Array(rom);

        // Cartridge Header

        _this._title = _this._sliceToString(data, 0x0134, 0x0143);
        _this._type = data[0x0147];
        _this._romSize = data[0x0148];
        _this._ramSize = data[0x0149];

        // Memory Map

        _this._rom = new Uint8Array(data, 0, 0x8000 * ROM_SIZE[_this._romSize]);
        _this._ram = new Uint8Array(0x2000 * RAM_SIZE[_this._ramSize]);

        // MBC

        _this._romBank = 1;
        _this._ramBank = 0;
        _this._ramEnabled = false;
        _this._mode = 0;
        return _this;
    }

    _createClass(Cart, [{
        key: 'fromJSON',
        value: function fromJSON(obj) {
            _get(Cart.prototype.__proto__ || Object.getPrototypeOf(Cart.prototype), 'fromJSON', this).call(this, obj);

            this._ram = new Uint8Array(obj._ram);
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            switch (addr >> 12) {
                case 0x0:case 0x1:
                case 0x2:case 0x3:
                    return this._rom[addr];
                case 0x4:case 0x5:
                case 0x6:case 0x7:
                    {
                        var pos = addr & 0x3fff;
                        return this._rom[0x4000 * this._romBank + pos];
                    }
                case 0xa:case 0xb:
                    {
                        var _pos = addr & 0x1fff;
                        return this._ram[0x2000 * this._ramBank + _pos];
                    }
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            switch (addr >> 12) {
                case 0x0:case 0x1:
                    return this._ramEnabled = (val & 0xf) == 0xa;
                case 0x2:case 0x3:
                    {
                        val &= 0x1f;
                        if ((val & 0x1f) == 0) val |= 1;

                        var bank = this._romBank & 0x60 | val;
                        var masked = bank & ROM_SIZE[this._romSize] * 2 - 1;

                        return this._romBank = masked;
                    }
                case 0x4:case 0x5:
                    {
                        val &= 3;
                        if (this._mode == 1) return this._ramBank = val;

                        var _bank = this._romBank & 0x1f | val << 5;
                        var _masked = _bank & ROM_SIZE[this._romSize] * 2 - 1;

                        return this._romBank = _masked;
                    }
                case 0x6:case 0x7:
                    return this._mode = val & 1;
                case 0xa:case 0xb:
                    if (!this._ramEnabled) return;
                    var pos = addr & 0x1fff;
                    return this._ram[0x2000 * this._ramBank + pos] = val;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: '_sliceToString',
        value: function _sliceToString(data, begin, end) {
            return String.fromCharCode.apply(String, _toConsumableArray(data.slice(begin, end))).replace(/\0/g, '');
        }
    }]);

    return Cart;
}(Serializable({ exclude: ['_rom'] }));

module.exports = Cart;

},{"../util/serializable":16}],10:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('gameboy:joypad');

var _require = require('../registers'),
    JOYP = _require.JOYP;

var _require2 = require('../interrupts'),
    INT_60 = _require2.INT_60;

var Joypad = function () {
    function Joypad(mmu) {
        _classCallCheck(this, Joypad);

        this._mmu = mmu;
        this._keys = {};

        // Registers

        this._select = 0;
        this._joyp = [0xf, 0xf];
    }

    _createClass(Joypad, [{
        key: 'keyDown',
        value: function keyDown(code) {
            debug('keydown %d', code);

            this._keys[code] = true;
            this._update();
        }
    }, {
        key: 'keyUp',
        value: function keyUp(code) {
            debug('keyup %d', code);

            this._keys[code] = false;
            this._update();
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            if (addr == JOYP) {
                return this._joyp[this._select];
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            if (addr == JOYP) {
                switch (val & 0x30) {
                    case 0x10:
                        this._select = 0;break; // button keys
                    case 0x20:
                        this._select = 1;break; // direction keys
                }
                return this._joyp[this._select];
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: '_update',
        value: function _update() {
            this._joyp = [0xf, 0xf];

            if (this._keys[40]) this._joyp[1] &= ~8; // down
            if (this._keys[13]) this._joyp[0] &= ~8; // start
            if (this._keys[38]) this._joyp[1] &= ~4; // up
            if (this._keys[16]) this._joyp[0] &= ~4; // select
            if (this._keys[37]) this._joyp[1] &= ~2; // left
            if (this._keys[90]) this._joyp[0] &= ~2; // a
            if (this._keys[39]) this._joyp[1] &= ~1; // right
            if (this._keys[88]) this._joyp[0] &= ~1; // b

            this._mmu.if |= INT_60;
        }
    }]);

    return Joypad;
}();

module.exports = Joypad;

},{"../interrupts":8,"../registers":12,"debug":14}],11:[function(require,module,exports){
(function (process){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var read = require('debug')('gameboy:mmu:read');
var write = require('debug')('gameboy:mmu:write');
var Cart = require('./io/cart');
var Serializable = require('./util/serializable');

var _require = require('./registers'),
    IF = _require.IF,
    IE = _require.IE;

/**
 * GameBoy Memory Areas
 *
 * $FFFF        Interrupt Enable Flag
 * $FF80-$FFFE  Zero Page - 127 bytes
 * $FF00-$FF7F  Hardware I/O Registers
 * $FEA0-$FEFF  Unusable Memory
 * $FE00-$FE9F  OAM - Object Attribute Memory
 * $E000-$FDFF  Echo RAM - Reserved, Do Not Use
 * $D000-$DFFF  Internal RAM - Bank 1-7 (switchable - CGB only)
 * $C000-$CFFF  Internal RAM - Bank 0 (fixed)
 * $A000-$BFFF  Cartridge RAM (If Available)
 * $9C00-$9FFF  BG Map Data 2
 * $9800-$9BFF  BG Map Data 1
 * $8000-$97FF  Character RAM
 * $4000-$7FFF  Cartridge ROM - Switchable Banks 1-xx
 * $0150-$3FFF  Cartridge ROM - Bank 0 (fixed)
 * $0100-$014F  Cartridge Header Area
 * $0000-$00FF  Restart and Interrupt Vectors
 */

var exclude = ['video', 'timer', 'lcd', 'gpu', 'joypad'];

var Mmu = function (_Serializable) {
    _inherits(Mmu, _Serializable);

    function Mmu() {
        var bios = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

        _classCallCheck(this, Mmu);

        var _this = _possibleConstructorReturn(this, (Mmu.__proto__ || Object.getPrototypeOf(Mmu)).call(this));

        _this._bios = new Uint8Array(bios);
        _this._biosDisabled = _this._bios.length == 0;

        // Mappings

        _this.video = null;
        _this.timer = null;
        _this.lcd = null;
        _this.gpu = null;
        _this.joypad = null;

        // Memory Map

        _this._wram = new Uint8Array(0x2000);
        _this._io = new Uint8Array(0x80);
        _this._zram = new Uint8Array(0x7f);
        _this._cart = null;

        _this.if = 0;
        _this.ie = 0;
        return _this;
    }

    _createClass(Mmu, [{
        key: 'init',
        value: function init() {
            this._biosDisabled = this._bios.length == 0;

            this.if = 0;
            this.ie = 0;
        }
    }, {
        key: 'fromJSON',
        value: function fromJSON(obj) {
            _get(Mmu.prototype.__proto__ || Object.getPrototypeOf(Mmu.prototype), 'fromJSON', this).call(this, obj);

            this._bios = new Uint8Array(obj._bios);
            this._wram = new Uint8Array(obj._wram);
            this._io = new Uint8Array(obj._io);
            this._zram = new Uint8Array(obj._zram);
        }
    }, {
        key: 'loadCart',
        value: function loadCart(rom) {
            this._cart = new Cart(rom);
        }
    }, {
        key: 'readByte',
        value: function readByte(addr) {
            addr &= 0xffff;

            read('$%s', addr.toString(16));

            switch (addr >> 12) {
                case 0x0:
                    if (!this._biosDisabled && addr < 0x100) {
                        return this._bios[addr];
                    }
                case 0x1:case 0x2:
                case 0x3:case 0x4:
                case 0x5:case 0x6:
                case 0x7:case 0xa:
                case 0xb:
                    return this._cart.readByte(addr);
                case 0x8:case 0x9:
                    return this.video.readByte(addr);
                case 0xc:case 0xd:
                    return this._wram[addr & 0x1fff];
                case 0xe:case 0xf:
                    if (addr == IE) return this.ie;
                    if (addr == IF) return this.if;
                    if (addr > 0xff7f) return this._zram[addr & 0x7f];
                    if (addr > 0xfeff) {
                        switch (addr & 0xff) {
                            case 0:
                                return this.joypad.readByte(addr);
                            case 0x04:case 0x05:
                            case 0x06:case 0x07:
                                return this.timer.readByte(addr);
                            case 0x40:case 0x42:
                            case 0x43:case 0x47:
                            case 0x48:case 0x49:
                            case 0x4a:case 0x4b:
                                return this.gpu.readByte(addr);
                            case 0x41:case 0x44:
                            case 0x45:
                                return this.lcd.readByte(addr);
                        }
                        return this._io[addr & 0xff];
                    }
                    if (addr > 0xfe9f) return 0;
                    if (addr > 0xfdff) return this.video.readByte(addr);
                    return this._wram[addr & 0x1fff];
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'readWord',
        value: function readWord(addr) {
            return this.readByte(addr) | this.readByte(addr + 1) << 8;
        }
    }, {
        key: 'writeByte',
        value: function writeByte(addr, val) {
            addr &= 0xffff;
            val &= 0xff;

            write('$%s = 0x%s', addr.toString(16), val.toString(16));

            if (process && process.env.TEST_ROM && addr == 0xff02 && val == 0x81) {
                var char = String.fromCharCode(this.readByte(0xff01));
                process.stdout.write(char);
            }

            switch (addr >> 12) {
                case 0x0:case 0x1:
                case 0x2:case 0x3:
                case 0x4:case 0x5:
                case 0x6:case 0x7:
                case 0xa:case 0xb:
                    return this._cart.writeByte(addr, val);
                case 0x8:case 0x9:
                    return this.video.writeByte(addr, val);
                case 0xc:case 0xd:
                    return this._wram[addr & 0x1fff] = val;
                case 0xe:case 0xf:
                    if (addr == IE) return this.ie = val;
                    if (addr == IF) return this.if = val;
                    if (addr > 0xff7f) return this._zram[addr & 0x7f] = val;
                    if (addr > 0xfeff) {
                        switch (addr & 0xff) {
                            case 0:
                                return this.joypad.writeByte(addr, val);
                            case 0x04:case 0x05:
                            case 0x06:case 0x07:
                                return this.timer.writeByte(addr, val);
                            case 0x40:case 0x42:
                            case 0x43:case 0x47:
                            case 0x48:case 0x49:
                            case 0x4a:case 0x4b:
                                return this.gpu.writeByte(addr, val);
                            case 0x41:case 0x44:
                            case 0x45:
                                return this.lcd.writeByte(addr, val);
                            case 0x46:
                                this.video.transfer(this, val);
                                break;
                            case 0x50:
                                this._biosDisabled = true;
                                break;
                        }
                        return this._io[addr & 0xff] = val;
                    }
                    if (addr > 0xfe9f) return;
                    if (addr > 0xfdff) return this.video.writeByte(addr, val);
                    return this._wram[addr & 0x1fff] = val;
            }

            throw new Error('unmapped address 0x' + addr.toString(16));
        }
    }, {
        key: 'writeWord',
        value: function writeWord(addr, val) {
            this.writeByte(addr, val);
            this.writeByte(addr + 1, val >> 8);
        }
    }]);

    return Mmu;
}(Serializable({ exclude: exclude }));

module.exports = Mmu;

}).call(this,require('_process'))
},{"./io/cart":9,"./registers":12,"./util/serializable":16,"_process":20,"debug":14}],12:[function(require,module,exports){
'use strict';

/**
 * FF00 - JOYP - Joypad (R/W)
 *
 * The eight gameboy buttons/direction keys are arranged in form of a 2x4
 * matrix. Select either button or direction keys by writing to this
 * register, then read-out bit 0-3.
 *
 * Bit 7 - Not used
 * Bit 6 - Not used
 * Bit 5 - P15 Select Button Keys      (0=Select)
 * Bit 4 - P14 Select Direction Keys   (0=Select)
 * Bit 3 - P13 Input Down  or Start    (0=Pressed) (Read Only)
 * Bit 2 - P12 Input Up    or Select   (0=Pressed) (Read Only)
 * Bit 1 - P11 Input Left  or Button B (0=Pressed) (Read Only)
 * Bit 0 - P10 Input Right or Button A (0=Pressed) (Read Only)
 */

exports.JOYP = 0xff00;

/**
 * FF04 - DIV - Divider Register (R/W)
 *
 * This register is incremented at rate of 16384Hz (~16779Hz on SGB).
 * Writing any value to this register resets it to 00h.
 *
 * Note: The divider is affected by CGB double speed mode, and will
 * increment at 32768Hz in double speed.
 */
exports.DIV = 0xff04;

/**
 * FF05 - TIMA - Timer counter (R/W)
 *
 * This timer is incremented by a clock frequency specified by the TAC
 * register ($FF07). When the value overflows (gets bigger than FFh)
 * then it will be reset to the value specified in TMA (FF06), and an
 * interrupt will be requested, as described below.
 */
exports.TIMA = 0xff05;

/**
 * FF06 - TMA - Timer Modulo (R/W)
 *
 * When the TIMA overflows, this data will be loaded.
 */
exports.TMA = 0xff06;

/**
 * FF07 - TAC - Timer Control (R/W)
 *
 * Bit 2    - Timer Enable
 * Bits 1-0 - Input Clock Select
 *      00: CPU Clock / 1024 (DMG, CGB:   4096 Hz, SGB:   ~4194 Hz)
 *      01: CPU Clock / 16   (DMG, CGB: 262144 Hz, SGB: ~268400 Hz)
 *      10: CPU Clock / 64   (DMG, CGB:  65536 Hz, SGB:  ~67110 Hz)
 *      11: CPU Clock / 256  (DMG, CGB:  16384 Hz, SGB:  ~16780 Hz)
 *
 * Note: The "Timer Enable" bit only affects the timer, the divider is
 * ALWAYS counting.
 */
exports.TAC = 0xff07;

/**
 * FF0F - IF - Interrupt Flag (R/W)
 *
 * Bit 0: V-Blank  Interrupt Request (INT 40h)  (1=Request)
 * Bit 1: LCD STAT Interrupt Request (INT 48h)  (1=Request)
 * Bit 2: Timer    Interrupt Request (INT 50h)  (1=Request)
 * Bit 3: Serial   Interrupt Request (INT 58h)  (1=Request)
 * Bit 4: Joypad   Interrupt Request (INT 60h)  (1=Request)
 */
exports.IF = 0xff0f;

/**
 * FF40 - LCDC - LCD Control (R/W)
 *
 * Bit 7 - LCD Display Enable             (0=Off, 1=On)
 * Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
 * Bit 5 - Window Display Enable          (0=Off, 1=On)
 * Bit 4 - BG & Window Tile Data Select   (0=8800-97FF, 1=8000-8FFF)
 * Bit 3 - BG Tile Map Display Select     (0=9800-9BFF, 1=9C00-9FFF)
 * Bit 2 - OBJ (Sprite) Size              (0=8x8, 1=8x16)
 * Bit 1 - OBJ (Sprite) Display Enable    (0=Off, 1=On)
 * Bit 0 - BG Display (for CGB see below) (0=Off, 1=On)
 */
exports.LCDC = 0xff40;

/**
 * FF41 - STAT - LCDC Status (R/W)
 *
 * Bit 6 - LYC=LY Coincidence Interrupt (1=Enable) (Read/Write)
 * Bit 5 - Mode 2 OAM Interrupt         (1=Enable) (Read/Write)
 * Bit 4 - Mode 1 V-Blank Interrupt     (1=Enable) (Read/Write)
 * Bit 3 - Mode 0 H-Blank Interrupt     (1=Enable) (Read/Write)
 * Bit 2 - Coincidence Flag  (0:LYC<>LY, 1:LYC=LY) (Read Only)
 * Bit 1-0 - Mode Flag       (Mode 0-3, see below) (Read Only)
 *           0: During H-Blank
 *           1: During V-Blank
 *           2: During Searching OAM-RAM
 *           3: During Transfering Data to LCD Driver
 */
exports.STAT = 0xff41;

/**
 * FF42 - SCY - Scroll Y (R/W)
 * FF43 - SCX - Scroll X (R/W)
 *
 * Specifies the position in the 256x256 pixels BG map (32x32 tiles) which
 * is to be displayed at the upper/left LCD display position.
 *
 * Values in range from 0-255 may be used for X/Y each, the video
 * controller automatically wraps back to the upper (left) position in BG
 * map when drawing exceeds the lower (right) border of the BG map area.
 */
exports.SCY = 0xff42;
exports.SCX = 0xff43;

/**
 * FF44 - LY - LCDC Y-Coordinate (R)
 *
 * The LY indicates the vertical line to which the present data is
 * transferred to the LCD Driver. The LY can take on any value between 0
 * through 153. The values between 144 and 153 indicate the V-Blank period.
 * Writing will reset the counter.
 */
exports.LY = 0xff44;

/**
 * FF45 - LYC - LY Compare (R/W)
 *
 * The gameboy permanently compares the value of the LYC and LY registers.
 * When both values are identical, the coincident bit in the STAT register
 * becomes set, and (if enabled) a STAT interrupt is requested.
 */
exports.LYC = 0xff45;

/**
 * FF46 - DMA - DMA Transfer and Start Address (W)
 *
 * Writing to this register launches a DMA transfer from ROM or RAM to OAM
 * memory (sprite attribute table). The written value specifies the transfer
 * source address divided by 100h, ie. source & destination are:
 *
 * Source:      XX00-XX9F   ;XX in range from 00-F1h
 * Destination: FE00-FE9F
 */
exports.DMA = 0xff46;

/**
 * FF47 - BGP - BG Palette Data (R/W) - Non CGB Mode Only
 *
 * This register assigns gray shades to the color numbers of the BG and
 * Window tiles.
 *
 * Bit 7-6 - Shade for Color Number 3
 * Bit 5-4 - Shade for Color Number 2
 * Bit 3-2 - Shade for Color Number 1
 * Bit 1-0 - Shade for Color Number 0
 *
 * The four possible gray shades are:
 * 0  White
 * 1  Light gray
 * 2  Dark gray
 * 3  Black
 *
 * In CGB Mode the Color Palettes are taken from CGB Palette Memory instead.
 */
exports.BGP = 0xff47;

/**
 * FF48 - OBP0 - Object Palette 0 Data (R/W) - Non CGB Mode Only
 *
 * This register assigns gray shades for sprite palette 0. It works exactly as
 * BGP (FF47), except that the lower two bits aren't used because sprite data
 * 00 is transparent.
 */
exports.OBP0 = 0xff48;

/**
 * FF49 - OBP1 - Object Palette 1 Data (R/W) - Non CGB Mode Only
 *
 * This register assigns gray shades for sprite palette 1. It works exactly as
 * BGP (FF47), except that the lower two bits aren't used because sprite data
 * 00 is transparent.
 */
exports.OBP1 = 0xff49;

/**
 * FF4A - WY - Window Y Position (R/W)
 * FF4B - WX - Window X Position minus 7 (R/W)
 *
 * Specifies the upper/left positions of the Window area. (The window is an
 * alternate background area which can be displayed above of the normal
 * background. OBJs (sprites) may be still displayed above or behind the
 * window, just as for normal BG.)
 * The window becomes visible (if enabled) when positions are set in range
 * WX=0..166, WY=0..143. A postion of WX=7, WY=0 locates the window at upper
 * left, it is then completly covering normal background.
 */
exports.WY = 0xff4a;
exports.WX = 0xff4b;

/**
 * FFFF - IE - Interrupt Enable (R/W)
 *
 * Bit 0: V-Blank  Interrupt Enable  (INT 40h)  (1=Enable)
 * Bit 1: LCD STAT Interrupt Enable  (INT 48h)  (1=Enable)
 * Bit 2: Timer    Interrupt Enable  (INT 50h)  (1=Enable)
 * Bit 3: Serial   Interrupt Enable  (INT 58h)  (1=Enable)
 * Bit 4: Joypad   Interrupt Enable  (INT 60h)  (1=Enable)
 */
exports.IE = 0xffff;

},{}],13:[function(require,module,exports){
'use strict';

function Canvas(width, height) {
    if (typeof window !== 'undefined') {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        return canvas;
    }

    return new (require('canvas'))(width, height);
}

module.exports = Canvas;

},{"canvas":17}],14:[function(require,module,exports){
"use strict";

module.exports = function () {
  return function () {};
};

},{}],15:[function(require,module,exports){
'use strict';

Number.prototype.signed = function () {
    return this & 0x80 ? -((0xff & ~this) + 1) : this;
};

},{}],16:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Serializable = function Serializable() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var T = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
        function _class() {
            _classCallCheck(this, _class);
        }

        return _class;
    }();
    return function (_T) {
        _inherits(_class2, _T);

        function _class2() {
            _classCallCheck(this, _class2);

            return _possibleConstructorReturn(this, (_class2.__proto__ || Object.getPrototypeOf(_class2)).apply(this, arguments));
        }

        _createClass(_class2, [{
            key: 'toJSON',
            value: function toJSON() {
                var _this2 = this;

                var exclude = opts.exclude,
                    include = opts.include;


                var exp = function exp() {
                    return true;
                };
                if (exclude) exp = function exp(v) {
                    return exclude.indexOf(v) < 0;
                };
                if (include) exp = function exp(v) {
                    return include.indexOf(v) > -1;
                };

                return Object.keys(this).filter(exp).reduce(function (obj, key) {
                    var value = void 0;

                    var prop = _this2[key];
                    if ('object' == (typeof prop === 'undefined' ? 'undefined' : _typeof(prop))) {
                        if ('function' == typeof prop.toJSON) {
                            value = prop.toJSON();
                        } else if ('Uint8Array' == prop.constructor.name) {
                            value = Array.from(_this2[key]);
                        }
                    } else value = _this2[key];

                    obj[key] = value;
                    return obj;
                }, {});
            }
        }, {
            key: 'fromJSON',
            value: function fromJSON(obj) {
                var _this3 = this;

                Object.keys(obj).filter(function (v) {
                    return _this3.hasOwnProperty(v);
                }).forEach(function (k) {
                    var p = _this3[k];
                    if ('object' == (typeof p === 'undefined' ? 'undefined' : _typeof(p)) && p.fromJSON) p.fromJSON(obj[k]);else _this3[k] = obj[k];
                });
            }
        }]);

        return _class2;
    }(T);
};

module.exports = Serializable;

},{}],17:[function(require,module,exports){
"use strict";

},{}],18:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],19:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.7.1
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

}).call(this,require('_process'))
},{"_process":20}],20:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],21:[function(require,module,exports){
(function (global){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function() {
  root.requestAnimationFrame = raf
  root.cancelAnimationFrame = caf
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":19}]},{},[4])(4)
});
