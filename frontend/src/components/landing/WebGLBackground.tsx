import { useEffect, useRef } from 'react';

const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_res;

  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float snoise(vec2 p) {
    const float F2 = 0.366025403784;
    const float G2 = 0.211324865405;
    vec2 i = floor(p + (p.x + p.y) * F2);
    vec2 a = p - i + (i.x + i.y) * G2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + G2;
    vec2 c = a - 1.0 + 2.0 * G2;
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h*h*h*h * vec3(
      dot(a, hash22(i)),
      dot(b, hash22(i + o)),
      dot(c, hash22(i + vec2(1.0)))
    );
    return dot(n, vec3(70.0));
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      v += w * snoise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      w *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float t = u_time * 0.07;

    vec2 q = vec2(fbm(uv + t * 0.5), fbm(uv + vec2(5.2, 1.3)));
    vec2 r = vec2(
      fbm(uv + 1.5*q + vec2(1.7, 9.2) + 0.15*t),
      fbm(uv + 1.5*q + vec2(8.3, 2.8) + 0.126*t)
    );
    float f = fbm(uv + 1.5*r + t * 0.04);
    f = 0.5 + 0.5 * f;

    vec3 c0 = vec3(0.043, 0.075, 0.102);
    vec3 c1 = vec3(0.118, 0.176, 0.224);
    vec3 c2 = vec3(0.204, 0.267, 0.325);
    vec3 c3 = vec3(0.780, 0.376, 0.114);

    vec3 col = c0;
    col = mix(col, c1, smoothstep(0.0, 0.42, f));
    col = mix(col, c2, smoothstep(0.38, 0.72, f));
    col = mix(col, c3, smoothstep(0.80, 1.0, f) * 0.18);

    float glow = length(r) * 0.25;
    col += c3 * glow * 0.07;

    vec2 vig = uv * (1.0 - uv);
    float vignette = pow(vig.x * vig.y * 16.0, 0.38);
    col *= 0.25 + 0.82 * vignette;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export default function WebGLBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.95 }}
    />
  );
}
