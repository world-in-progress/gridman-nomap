import mapboxgl, { Map, CustomLayerInterface } from 'mapbox-gl';

interface Props {
    bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export default class PatchCustomLayer implements CustomLayerInterface {
    id: string;
    type: 'custom';
    bounds: Props['bounds'];
    positions: Float32Array | null = null;
    map: Map | null = null;
    gl: WebGLRenderingContext | null = null;
    program: WebGLProgram | null = null;
    positionBuffer: WebGLBuffer | null = null;

    constructor(id: string, bounds: Props['bounds']) {
        this.id = id;
        this.type = 'custom';
        this.bounds = bounds;
    }

    onAdd(map: Map, gl: WebGLRenderingContext): void {
        this.map = map;
        this.gl = gl;

        // 编译着色器
        this.program = this.createProgram(gl);

        // 创建缓冲区
        this.positionBuffer = gl.createBuffer();
        if (this.positionBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        }

        // 初始计算顶点
        this.updatePositions(map);
    }

    onRemove(): void {
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        if (this.positionBuffer) {
            this.gl!.deleteBuffer(this.positionBuffer);
        }
        this.map = null;
        this.gl = null;
    }

    // 顶点着色器源代码
    private createVertexShader(): string {
        return `
            attribute vec2 a_position;
            uniform mat4 u_matrix;
            void main() {
                gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
            }
        `;
    }

    // 片元着色器源代码
    private createFragmentShader(): string {
        return `
            precision mediump float;
            uniform vec4 u_color;
            void main() {
                gl_FragColor = u_color;
            }
        `;
    }

    // 创建并链接着色器程序
    private createProgram(gl: WebGLRenderingContext): WebGLProgram {
        const vsSource = this.createVertexShader();
        const fsSource = this.createFragmentShader();

        const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        // 链接检查
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('着色器链接失败:', gl.getProgramInfoLog(program));
            throw new Error('Shader link failed');
        }

        return program;
    }

    private createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        // 编译检查
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('着色器编译失败:', gl.getShaderInfoLog(shader));
            throw new Error('Shader compile failed');
        }

        return shader;
    }

    // 更新顶点位置（基于当前地图视图）
    private updatePositions(map: Map): void {
        if (!this.bounds || !map) return;

        const [minLng, minLat, maxLng, maxLat] = this.bounds;
        const corners: [number, number][] = [
            [minLng, minLat], // 西南
            [maxLng, minLat], // 东南
            [maxLng, maxLat], // 东北
            [minLng, maxLat]  // 西北
        ];

        // 转换为像素坐标
        const pixelCorners = corners.map(([lng, lat]) => map.project([lng, lat]));

        // 构建两个三角形的 WebGL 顶点（像素坐标，x/y）
        this.positions = new Float32Array([
            // 三角形 1: 西南 -> 东南 -> 东北
            pixelCorners[0].x, pixelCorners[0].y,
            pixelCorners[1].x, pixelCorners[1].y,
            pixelCorners[2].x, pixelCorners[2].y,
            // 三角形 2: 东北 -> 西北 -> 西南
            pixelCorners[2].x, pixelCorners[2].y,
            pixelCorners[3].x, pixelCorners[3].y,
            pixelCorners[0].x, pixelCorners[0].y
        ]);
    }

    // 渲染函数（修复类型：matrix 为 Float32Array）
    render(gl: WebGLRenderingContext, matrix: Float32Array): void {
        if (!this.positions || !this.program || !this.positionBuffer || !matrix || matrix.length !== 16) {
            return; // 类型安全检查
        }

        // 更新位置（视图变化时重新计算）
        if (this.map) {
            this.updatePositions(this.map);
        }

        // 使用程序
        gl.useProgram(this.program);

        // 上传顶点数据
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

        // 绑定属性
        const positionLocation = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // 设置 uniform：矩阵和颜色（matrix 已为 Float32Array，无需断言）
        const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix');
        gl.uniformMatrix4fv(matrixLocation, false, matrix);

        const colorLocation = gl.getUniformLocation(this.program, 'u_color');
        gl.uniform4fv(colorLocation, [1.0, 0.0, 0.0, 0.5]); // 红色半透明

        // 绘制三角形
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}