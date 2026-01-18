/**
 * ComputeKit WASM Functions - Optimized blur with manual SIMD-style processing
 * Uses u32 loads/stores and loop unrolling for maximum performance
 */

const BUFFER_START: usize = 65536;

export function getBufferPtr(): usize {
  return BUFFER_START;
}

/**
 * Highly optimized blur using:
 * - memory.copy for fast buffer copy
 * - u32 loads/stores (4 bytes at once)
 * - Loop unrolling
 * - Reciprocal multiplication instead of division
 */
export function blurImage(width: i32, height: i32, passes: i32): void {
  const size: i32 = width * height * 4;
  const TEMP: usize = BUFFER_START + size;
  const stride: i32 = width * 4;

  for (let pass: i32 = 0; pass < passes; pass++) {
    // === HORIZONTAL BLUR PASS ===
    for (let y: i32 = 0; y < height; y++) {
      const rowIn: usize = BUFFER_START + y * stride;
      const rowOut: usize = TEMP + y * stride;

      // Copy first pixel (edge)
      store<u32>(rowOut, load<u32>(rowIn));

      // Process interior pixels
      for (let x: i32 = 1; x < width - 1; x++) {
        const px: i32 = x << 2; // x * 4
        const pxL: i32 = px - 4;
        const pxR: i32 = px + 4;

        // Load RGB from left, center, right
        const lR: i32 = load<u8>(rowIn + pxL);
        const lG: i32 = load<u8>(rowIn + pxL + 1);
        const lB: i32 = load<u8>(rowIn + pxL + 2);

        const cR: i32 = load<u8>(rowIn + px);
        const cG: i32 = load<u8>(rowIn + px + 1);
        const cB: i32 = load<u8>(rowIn + px + 2);

        const rR: i32 = load<u8>(rowIn + pxR);
        const rG: i32 = load<u8>(rowIn + pxR + 1);
        const rB: i32 = load<u8>(rowIn + pxR + 2);

        // Sum and divide by 3: (x * 10923) >> 15 ≈ x / 3
        const avgR: i32 = ((lR + cR + rR) * 10923) >> 15;
        const avgG: i32 = ((lG + cG + rG) * 10923) >> 15;
        const avgB: i32 = ((lB + cB + rB) * 10923) >> 15;

        // Store as packed u32 (ABGR little-endian = RGBA bytes)
        store<u32>(rowOut + px, (255 << 24) | (avgB << 16) | (avgG << 8) | avgR);
      }

      // Copy last pixel (edge)
      store<u32>(rowOut + (width - 1) * 4, load<u32>(rowIn + (width - 1) * 4));
    }

    // === VERTICAL BLUR PASS ===
    // Copy top row (edge)
    memory.copy(BUFFER_START, TEMP, stride);

    // Process interior rows
    for (let y: i32 = 1; y < height - 1; y++) {
      const rowAbove: usize = TEMP + (y - 1) * stride;
      const rowCenter: usize = TEMP + y * stride;
      const rowBelow: usize = TEMP + (y + 1) * stride;
      const rowOut: usize = BUFFER_START + y * stride;

      // Unroll by 4 pixels
      let x: i32 = 0;
      const xEnd4: i32 = width - 3;

      while (x < xEnd4) {
        // Process 4 consecutive pixels
        for (let i: i32 = 0; i < 4; i++) {
          const px: i32 = (x + i) << 2;

          const tR: i32 = load<u8>(rowAbove + px);
          const tG: i32 = load<u8>(rowAbove + px + 1);
          const tB: i32 = load<u8>(rowAbove + px + 2);

          const mR: i32 = load<u8>(rowCenter + px);
          const mG: i32 = load<u8>(rowCenter + px + 1);
          const mB: i32 = load<u8>(rowCenter + px + 2);

          const bR: i32 = load<u8>(rowBelow + px);
          const bG: i32 = load<u8>(rowBelow + px + 1);
          const bB: i32 = load<u8>(rowBelow + px + 2);

          const avgR: i32 = ((tR + mR + bR) * 10923) >> 15;
          const avgG: i32 = ((tG + mG + bG) * 10923) >> 15;
          const avgB: i32 = ((tB + mB + bB) * 10923) >> 15;

          store<u32>(rowOut + px, (255 << 24) | (avgB << 16) | (avgG << 8) | avgR);
        }
        x += 4;
      }

      // Handle remaining pixels
      while (x < width) {
        const px: i32 = x << 2;

        const tR: i32 = load<u8>(rowAbove + px);
        const tG: i32 = load<u8>(rowAbove + px + 1);
        const tB: i32 = load<u8>(rowAbove + px + 2);

        const mR: i32 = load<u8>(rowCenter + px);
        const mG: i32 = load<u8>(rowCenter + px + 1);
        const mB: i32 = load<u8>(rowCenter + px + 2);

        const bR: i32 = load<u8>(rowBelow + px);
        const bG: i32 = load<u8>(rowBelow + px + 1);
        const bB: i32 = load<u8>(rowBelow + px + 2);

        const avgR: i32 = ((tR + mR + bR) * 10923) >> 15;
        const avgG: i32 = ((tG + mG + bG) * 10923) >> 15;
        const avgB: i32 = ((tB + mB + bB) * 10923) >> 15;

        store<u32>(rowOut + px, (255 << 24) | (avgB << 16) | (avgG << 8) | avgR);
        x++;
      }
    }

    // Copy bottom row (edge)
    memory.copy(
      BUFFER_START + (height - 1) * stride,
      TEMP + (height - 1) * stride,
      stride
    );
  }
}
