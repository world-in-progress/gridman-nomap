import mapboxgl from 'mapbox-gl'

export default class PatchCustomLayer implements mapboxgl.CustomLayerInterface {
    id: string
    readonly type = 'custom'
    readonly renderingMode = '2d'


    private bounds4326: [number, number, number, number]
    private program!: WebGLProgram
    private buffer!: WebGLBuffer

    constructor(id: string, bounds4326: [number, number, number, number]) {
        this.id = id
        this.bounds4326 = bounds4326
    }

    onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
        const vertexSource = `
      attribute vec2 a_pos;
      uniform mat4 u_matrix;
      void main() {
        gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      }
    `

        const fragmentSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 0.3);
      }
    `

        const vs = gl.createShader(gl.VERTEX_SHADER)!
        gl.shaderSource(vs, vertexSource)
        gl.compileShader(vs)

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!
        gl.shaderSource(fs, fragmentSource)
        gl.compileShader(fs)

        this.program = gl.createProgram()!
        gl.attachShader(this.program, vs)
        gl.attachShader(this.program, fs)
        gl.linkProgram(this.program)

        this.buffer = gl.createBuffer()!
    }

    render(gl: WebGLRenderingContext, matrix: number[]) {
        gl.useProgram(this.program)

        const [minLng, minLat, maxLng, maxLat] = this.bounds4326

        // 4326 → 3857
        const sw = mapboxgl.MercatorCoordinate.fromLngLat([minLng, minLat])
        const ne = mapboxgl.MercatorCoordinate.fromLngLat([maxLng, maxLat])

        const vertices = new Float32Array([
            sw.x, sw.y,
            ne.x, sw.y,
            ne.x, ne.y,
            sw.x, ne.y,
        ])

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        const aPos = gl.getAttribLocation(this.program, 'a_pos')
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

        const uMatrix = gl.getUniformLocation(this.program, 'u_matrix')
        gl.uniformMatrix4fv(uMatrix, false, matrix)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
}
