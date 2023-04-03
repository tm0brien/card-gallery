import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Mesh } from 'three'

function Box(props: any) {
    // This reference gives us direct access to the THREE.Mesh object
    const ref = useRef<Mesh>()

    // Hold state for hovered and clicked events
    const [hovered, hover] = useState(false)
    const [clicked, click] = useState(false)

    // Subscribe this component to the render-loop, rotate the mesh every frame
    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta
        }
    })

    // Return the view, these are regular Threejs elements expressed in JSX
    return (
        <mesh
            {...props}
            ref={ref}
            scale={clicked ? 1.5 : 1}
            onClick={() => click(!clicked)}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
        </mesh>
    )
}

const Root: React.FC = () => {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <Canvas>
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <pointLight position={[-10, -10, -10]} />
                <Box position={[-1.2, 0, 0]} />
                <Box position={[1.2, 0, 0]} />
                <OrbitControls />
            </Canvas>
        </div>
    )
}

export default Root
