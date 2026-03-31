/**
 * 3D Component Tree Visualization
 * Three.js-based visualization for massive component trees
 * @module panel/components/Visualizations3D/ComponentTree3D
 */

import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { CommitData } from '@/shared/types';
import styles from './ComponentTree3D.module.css';

// OrbitControls will be loaded dynamically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrbitControlsType = any;

interface ComponentTree3DProps {
  commits: CommitData[];
  selectedCommitId?: string | null;
  onSelectComponent?: (name: string) => void;
  width?: number;
  height?: number;
}

/**
 * 3D Component Tree Component
 */
export const ComponentTree3D: React.FC<ComponentTree3DProps> = ({
  commits,
  selectedCommitId,
  onSelectComponent,
  width = 800,
  height = 600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [isInitialized, setIsInitialized] = useState(false);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [stats, setStats] = useState({ nodeCount: 0, maxDepth: 0 });

  // Initialize Three.js scene
  useEffect(() => {
    const initScene = async () => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 50, 200);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 50, 100);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls - dynamically import to avoid type issues
    // @ts-ignore - three.js examples types
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 300;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 50, 0x444444, 0x222222);
    scene.add(gridHelper);

    setIsInitialized(true);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    };
    
    initScene();

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [width, height]);

  // Build tree visualization
  const buildTree = useCallback(() => {
    if (!sceneRef.current || !commits.length) return;

    // Remove existing mesh
    if (instancedMeshRef.current) {
      sceneRef.current.remove(instancedMeshRef.current);
      instancedMeshRef.current.dispose();
    }

    const commit = commits.find(c => c.id === selectedCommitId) || commits[0];
    if (!commit?.nodes?.length) return;

    const nodes = commit.nodes;
    const nodeCount = nodes.length;

    // Build parent-child relationships
    const childrenMap = new Map<number, number[]>();
    const depthMap = new Map<number, number>();

    for (const node of nodes) {
      childrenMap.set(node.id, node.children);
      
      // Calculate depth
      let depth = 0;
      let currentId = node.id;
      while (currentId !== null) {
        const parent = nodes.find(n => n.children.includes(currentId));
        if (!parent) break;
        depth++;
        currentId = parent.id;
      }
      depthMap.set(node.id, depth);
    }

    const maxDepth = Math.max(...depthMap.values());

    // Create instanced mesh
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4da6ff,
      shininess: 100,
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, nodeCount);
    instancedMeshRef.current = instancedMesh;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Position nodes
    nodes.forEach((node, index) => {
      const depth = depthMap.get(node.id) || 0;
      const siblings = nodes.filter(n => depthMap.get(n.id) === depth);
      const siblingIndex = siblings.findIndex(n => n.id === node.id);
      
      // Spiral layout
      const angle = (siblingIndex / siblings.length) * Math.PI * 2 + depth * 0.5;
      const radius = 10 + depth * 8;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -depth * 5;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(1 + (node.actualDuration || 0) / 10);
      dummy.updateMatrix();

      instancedMesh.setMatrixAt(index, dummy.matrix);

      // Color by render time
      const renderTime = node.actualDuration || 0;
      if (renderTime > 16) {
        color.setHex(0xff4444); // Red for slow
      } else if (renderTime > 8) {
        color.setHex(0xffaa44); // Orange for medium
      } else {
        color.setHex(0x44ff88); // Green for fast
      }
      instancedMesh.setColorAt(index, color);

      // Store node ID for raycasting
      (instancedMesh.userData as any).nodeIds = (instancedMesh.userData as any).nodeIds || [];
      (instancedMesh.userData as any).nodeIds[index] = node;
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor!.needsUpdate = true;
    sceneRef.current.add(instancedMesh);

    setStats({ nodeCount, maxDepth });
  }, [commits, selectedCommitId]);

  // Rebuild when data changes
  useEffect(() => {
    if (isInitialized) {
      buildTree();
    }
  }, [isInitialized, buildTree]);

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !instancedMeshRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const intersection = raycasterRef.current.intersectObject(instancedMeshRef.current);
    
    if (intersection?.length > 0) {
      const instanceId = intersection[0]?.instanceId;
      const node = (instancedMeshRef.current.userData as any).nodeIds?.[instanceId!];
      if (node) {
        setHoveredComponent(node.displayName || `Component ${node.id}`);
      }
    } else {
      setHoveredComponent(null);
    }
  }, [width, height]);

  const handleClick = useCallback(() => {
    if (hoveredComponent && onSelectComponent) {
      onSelectComponent(hoveredComponent);
    }
  }, [hoveredComponent, onSelectComponent]);

  // Reset camera
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 50, 100);
      controlsRef.current.reset();
    }
  };

  // Toggle VR mode (WebXR)
  const enterVR = async () => {
    if (!rendererRef.current) return;
    
    const xr = (navigator as any).xr;
    if (!xr) {
      alert('WebXR not supported in this browser');
      return;
    }

    try {
      const session = await xr.requestSession('immersive-vr');
      rendererRef.current.xr.enabled = true;
      rendererRef.current.xr.setSession(session);
    } catch (error) {
      console.error('VR failed:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <span>{stats.nodeCount.toLocaleString()} nodes</span>
          <span>Depth: {stats.maxDepth}</span>
          {hoveredComponent && (
            <span className={styles.hovered}>{hoveredComponent}</span>
          )}
        </div>
        <div className={styles.controls}>
          <button onClick={resetCamera}>Reset View</button>
          <button onClick={enterVR}>🥽 Enter VR</button>
        </div>
      </div>
      
      <div
        ref={containerRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ width, height }}
      />

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.colorBox} style={{ background: '#44ff88' }} />
          <span>Fast (&lt;8ms)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.colorBox} style={{ background: '#ffaa44' }} />
          <span>Medium (8-16ms)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.colorBox} style={{ background: '#ff4444' }} />
          <span>Slow (&gt;16ms)</span>
        </div>
      </div>
    </div>
  );
};

export default ComponentTree3D;
