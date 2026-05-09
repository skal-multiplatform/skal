const std = @import("std");
const builtin = @import("builtin");
const build_options = @import("build_options");

pub const is_android: bool = build_options.is_android;
pub const is_posix: bool = builtin.os.tag != .windows;
pub const is_macos: bool = builtin.os.tag == .macos;
pub const is_linux: bool = builtin.os.tag == .linux and !is_android;
pub const is_bionic: bool = is_android;

pub const arch = builtin.target.cpu.arch;

pub const Engine = @TypeOf(build_options.engine);
pub const engine: Engine = build_options.engine;
