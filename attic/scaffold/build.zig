const std = @import("std");

const Build = std.Build;
const Target = std.Target;
const ResolvedTarget = Build.ResolvedTarget;

pub fn build(b: *Build) void {
    const optimize = b.standardOptimizeOption(.{});

    const target_os = b.option([]const u8, "os", "Target OS: host | android") orelse "host";
    const target_arch = b.option([]const u8, "arch", "Target arch: native | aarch64 | armv7 | x86_64") orelse "native";
    const ndk_sysroot = b.option([]const u8, "ndk-sysroot", "Path to Android NDK sysroot");
    const android_api: u32 = b.option(u32, "android-api", "Android API level (>=24)") orelse 24;
    const engine_kind = b.option(EngineKind, "engine", "JS engine: null | jsc") orelse .@"null";
    const want_lib = b.option(bool, "lib", "Build shared library (libskal.so)") orelse std.mem.eql(u8, target_os, "android");
    const want_cli = b.option(bool, "cli", "Build CLI executable (skal)") orelse !std.mem.eql(u8, target_os, "android");
    const jsc_dir_opt = b.option([]const u8, "jsc-dir", "Directory containing JSC libs+headers (required when engine=jsc)");

    const target = resolveTarget(b, target_os, target_arch, android_api);
    const is_android = target.result.abi.isAndroid();

    if (is_android and ndk_sysroot == null) {
        std.debug.print(
            \\error: -Dndk-sysroot=<path> is required for Android targets.
            \\   set it to: $ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/<host-tag>/sysroot
            \\
        , .{});
        std.process.exit(1);
    }
    if (is_android) {
        b.sysroot = ndk_sysroot.?;
        b.libc_file = generateAndroidLibcFile(b, ndk_sysroot.?, target.result.cpu.arch, android_api);
    }

    const build_options = b.addOptions();
    build_options.addOption(EngineKind, "engine", engine_kind);
    build_options.addOption(bool, "is_android", is_android);
    build_options.addOption(u32, "android_api", android_api);

    const skal_module = b.addModule("skal", .{
        .root_source_file = b.path("src/skal.zig"),
        .target = target,
        .optimize = optimize,
    });
    skal_module.addOptions("build_options", build_options);

    if (is_android) applyNdkPaths(skal_module, ndk_sysroot.?, target.result.cpu.arch, android_api);
    linkEngine(b, skal_module, engine_kind, jsc_dir_opt);

    if (want_lib) {
        if (is_android) {
            skal_module.linkSystemLibrary("log", .{});
            skal_module.linkSystemLibrary("c", .{});
            skal_module.linkSystemLibrary("m", .{});
        } else {
            skal_module.link_libc = true;
        }
        const lib = b.addLibrary(.{
            .name = "skal",
            .linkage = .dynamic,
            .root_module = skal_module,
        });
        b.installArtifact(lib);
    }

    if (want_cli) {
        const exe_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        });
        exe_module.addImport("skal", skal_module);
        exe_module.addOptions("build_options", build_options);
        if (is_android) applyNdkPaths(exe_module, ndk_sysroot.?, target.result.cpu.arch, android_api);
        linkEngine(b, exe_module, engine_kind, jsc_dir_opt);

        exe_module.link_libc = true;
        const exe = b.addExecutable(.{
            .name = "skal",
            .root_module = exe_module,
        });
        b.installArtifact(exe);

        const run = b.addRunArtifact(exe);
        run.step.dependOn(b.getInstallStep());
        if (b.args) |args| run.addArgs(args);
        b.step("run", "Run the CLI smoke test").dependOn(&run.step);
    }

    const test_module = b.createModule(.{
        .root_source_file = b.path("src/skal.zig"),
        .target = b.resolveTargetQuery(.{}),
        .optimize = optimize,
    });
    test_module.addOptions("build_options", build_options);
    const tests = b.addTest(.{ .root_module = test_module });
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&b.addRunArtifact(tests).step);
}

const EngineKind = enum { @"null", jsc };

fn resolveTarget(b: *Build, os_str: []const u8, arch_str: []const u8, api: u32) ResolvedTarget {
    if (std.mem.eql(u8, os_str, "host")) {
        return b.standardTargetOptions(.{});
    }
    if (!std.mem.eql(u8, os_str, "android")) {
        std.debug.panic("unsupported -Dos={s} (expected: host|android)", .{os_str});
    }

    const arch: Target.Cpu.Arch = if (std.mem.eql(u8, arch_str, "aarch64") or std.mem.eql(u8, arch_str, "arm64"))
        .aarch64
    else if (std.mem.eql(u8, arch_str, "armv7") or std.mem.eql(u8, arch_str, "arm"))
        .arm
    else if (std.mem.eql(u8, arch_str, "x86_64"))
        .x86_64
    else
        std.debug.panic("unsupported -Darch={s} for android", .{arch_str});

    return b.resolveTargetQuery(.{
        .cpu_arch = arch,
        .os_tag = .linux,
        .abi = if (arch == .arm) .androideabi else .android,
        .android_api_level = api,
    });
}

fn ndkArchDir(arch: Target.Cpu.Arch) []const u8 {
    return switch (arch) {
        .aarch64 => "aarch64-linux-android",
        .arm => "arm-linux-androideabi",
        .x86_64 => "x86_64-linux-android",
        .x86 => "i686-linux-android",
        else => std.debug.panic("unsupported android arch: {s}", .{@tagName(arch)}),
    };
}

fn generateAndroidLibcFile(b: *Build, sysroot: []const u8, arch: Target.Cpu.Arch, api: u32) []const u8 {
    const arch_dir = ndkArchDir(arch);
    const include = b.pathJoin(&.{ sysroot, "usr", "include" });
    const arch_include = b.pathJoin(&.{ include, arch_dir });
    const api_str = std.fmt.allocPrint(b.allocator, "{d}", .{api}) catch unreachable;
    const crt = b.pathJoin(&.{ sysroot, "usr", "lib", arch_dir, api_str });

    const text = std.fmt.allocPrint(
        b.allocator,
        "include_dir={s}\nsys_include_dir={s}\ncrt_dir={s}\nmsvc_lib_dir=\nkernel32_lib_dir=\ngcc_dir=\n",
        .{ include, arch_include, crt },
    ) catch unreachable;

    const out = b.pathJoin(&.{ b.cache_root.path orelse ".zig-cache", b.fmt("android-libc-{s}-{d}.txt", .{ arch_dir, api }) });
    const dir = std.fs.path.dirname(out) orelse ".";
    // Use libc directly — stable across Zig versions while std.fs is in flux.
    var dir_z_buf: [1024]u8 = undefined;
    @memcpy(dir_z_buf[0..dir.len], dir);
    dir_z_buf[dir.len] = 0;
    _ = std.c.mkdir(@ptrCast(&dir_z_buf), 0o755);
    var out_z_buf: [1024]u8 = undefined;
    @memcpy(out_z_buf[0..out.len], out);
    out_z_buf[out.len] = 0;
    const fd = std.c.open(@ptrCast(&out_z_buf), .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, @as(c_uint, 0o644));
    if (fd < 0) std.debug.panic("failed to open libc file: {s}", .{out});
    defer _ = std.c.close(fd);
    var written: usize = 0;
    while (written < text.len) {
        const n = std.c.write(fd, text.ptr + written, text.len - written);
        if (n <= 0) std.debug.panic("failed to write libc file", .{});
        written += @intCast(n);
    }
    return out;
}

fn applyNdkPaths(module: *std.Build.Module, sysroot: []const u8, arch: Target.Cpu.Arch, api: u32) void {
    _ = sysroot;
    _ = sysroot;
    const b = module.owner;
    // With --sysroot set on the Build, linker `-L` and `-isystem` paths
    // beginning with `/` are interpreted as sysroot-relative. So we pass
    // the paths *without* the sysroot prefix.
    module.addSystemIncludePath(.{ .cwd_relative = "/usr/include" });
    const arch_dir = switch (arch) {
        .aarch64 => "aarch64-linux-android",
        .arm => "arm-linux-androideabi",
        .x86_64 => "x86_64-linux-android",
        .x86 => "i686-linux-android",
        else => std.debug.panic("unsupported android arch: {s}", .{@tagName(arch)}),
    };
    module.addSystemIncludePath(.{ .cwd_relative = b.pathJoin(&.{ "/usr/include", arch_dir }) });
    // NDK lays out libs as usr/lib/<triple>/<api>/lib*.so. The API-specific
    // subdir holds runtime libs (liblog.so etc.); the triple-only dir holds
    // libc++ archives. Add both.
    const api_str = std.fmt.allocPrint(b.allocator, "{d}", .{api}) catch unreachable;
    module.addLibraryPath(.{ .cwd_relative = b.pathJoin(&.{ "/usr/lib", arch_dir, api_str }) });
    module.addLibraryPath(.{ .cwd_relative = b.pathJoin(&.{ "/usr/lib", arch_dir }) });
}

fn linkEngine(
    b: *Build,
    module: *std.Build.Module,
    engine: EngineKind,
    jsc_dir_opt: ?[]const u8,
) void {
    switch (engine) {
        .@"null" => {},
        .jsc => {
            const jsc_dir = jsc_dir_opt orelse blk: {
                if (b.graph.environ_map.get("SKAL_JSC_DIR")) |d| break :blk d;
                std.debug.print(
                    \\error: -Dengine=jsc requires either:
                    \\         -Djsc-dir=<path>
                    \\       or env var SKAL_JSC_DIR=<path>
                    \\   The directory must contain JavaScriptCore for the target ABI.
                    \\
                , .{});
                std.process.exit(1);
            };
            module.addSystemIncludePath(.{ .cwd_relative = b.pathJoin(&.{ jsc_dir, "include" }) });
            // Static archives go through addObjectFile (not linkSystemLibrary)
            // because Zig's system-library lookup is sysroot-scoped when a
            // sysroot is set, and our JSC install dir is outside it.
            // Link order matters for GNU ld; lld is forgiving but match:
            // JSC depends on WTF + bmalloc; ICU is leaf; libc++ runtime last.
            const lib_dir = b.pathJoin(&.{ jsc_dir, "lib" });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libJavaScriptCore.a" }) });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libWTF.a" }) });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libbmalloc.a" }) });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libicui18n.a" }) });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libicuuc.a" }) });
            module.addObjectFile(.{ .cwd_relative = b.pathJoin(&.{ lib_dir, "libicudata.a" }) });
            // JSC is C++; need the C++ runtime. On Android the NDK's
            // libc++ is the unified static + shared dispatch.
            module.linkSystemLibrary("c++", .{});
        },
    }
}
