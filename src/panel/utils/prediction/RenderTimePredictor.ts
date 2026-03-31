
import type { Tensor } from '@tensorflow/tfjs';
import * as tf from '@tensorflow/tfjs';
import type { AnalysisContext, PerformancePrediction } from '@/panel/utils/llm/types';
import { logger } from '@/shared/logger';

/**
 * Feature vector for prediction
 */
interface FeatureVector {
  renderCount: number;
  wastedRenderRate: number;
  componentDepth: number;
  childCount: number;
  propCount: number;
  hasMemo: number;
  hasCallback: number;
  hasMemoizedProps: number;
  averageRenderTime: number;
}

/**
 * Render Time Predictor
 * Predicts performance impact of optimizations using ML
 */
export class RenderTimePredictor {
  private isInitialized = false;
  private model: any = null;
  private trainingData: Array<{ features: FeatureVector; actualTime: number }> = [];
  private readonly MODEL_KEY = 'perf-predictor-model';
  private readonly TRAINING_DATA_KEY = 'perf-predictor-data';

  /**
   * Initialize the predictor
   * Loads existing model or creates new one
   */
  async initialize(): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling TF.js if not needed
      const tf = await import('@tensorflow/tfjs');
      
      // Try to load saved model
      const savedModel = await this.loadModel();
      if (savedModel) {
        this.model = savedModel;
      } else {
        // Create simple neural network
        this.model = tf.sequential({
          layers: [
            tf.layers.dense({ inputShape: [9], units: 16, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 8, activation: 'relu' }),
            tf.layers.dense({ units: 1 }),
          ],
        });

        this.model.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'meanSquaredError',
        });
      }

      // Load training data
      await this.loadTrainingData();

      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize predictor', {
        error: error instanceof Error ? error.message : String(error),
        source: 'RenderTimePredictor',
      });
      return false;
    }
  }

  /**
   * Predict render time after optimization
   */
  async predict(
    context: AnalysisContext,
    optimization: string
  ): Promise<PerformancePrediction> {
    if (!this.isInitialized) {
      // Fallback to heuristic prediction
      return this.heuristicPredict(context, optimization);
    }

    try {
      const tf = await import('@tensorflow/tfjs');
      
      const currentFeatures = this.extractFeatures(context);
      const optimizedFeatures = this.applyOptimization(currentFeatures, optimization);

      // Predict current and optimized times
      const currentInput = tf.tensor2d([Object.values(currentFeatures)]);
      const optimizedInput = tf.tensor2d([Object.values(optimizedFeatures)]);

      const [currentPrediction, optimizedPrediction] = await Promise.all([
        this.model.predict(currentInput) as Promise<Tensor>,
        this.model.predict(optimizedInput) as Promise<Tensor>,
      ]);

      const currentTime = (await currentPrediction.data())[0]!;
      const optimizedTime = (await optimizedPrediction.data())[0]!;

      // Cleanup tensors
      currentInput.dispose();
      optimizedInput.dispose();
      currentPrediction.dispose();
      optimizedPrediction.dispose();

      const improvement = currentTime - optimizedTime;
      const improvementPercentage = (improvement / currentTime) * 100;

      return {
        currentRenderTime: currentTime,
        predictedRenderTime: optimizedTime,
        improvementPercentage: Math.max(0, improvementPercentage),
        confidence: this.calculateConfidence(currentFeatures),
        reasoning: this.generateReasoning(optimization, improvementPercentage),
      };
    } catch (error) {
      logger.error('Prediction failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'RenderTimePredictor',
      });
      return this.heuristicPredict(context, optimization);
    }
  }

  /**
   * Train model with actual performance data
   */
  async train(context: AnalysisContext, actualRenderTime: number): Promise<void> {
    if (!this.isInitialized) return;

    const features = this.extractFeatures(context);
    this.trainingData.push({ features, actualTime: actualRenderTime });

    // Keep only recent data
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-1000);
    }

    // Train periodically
    if (this.trainingData.length % 10 === 0) {
      await this.retrain();
    }

    await this.saveTrainingData();
  }

  /**
   * Retrain model with accumulated data
   */
  private async retrain(): Promise<void> {
    if (this.trainingData.length < 20) return;

    try {
      const tf = await import('@tensorflow/tfjs');
      
      const xs = this.trainingData.map(d => Object.values(d.features));
      const ys = this.trainingData.map(d => d.actualTime);

      const xsTensor = tf.tensor2d(xs);
      const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

      await this.model.fit(xsTensor, ysTensor, {
        epochs: 10,
        batchSize: 8,
        verbose: 0,
      });

      xsTensor.dispose();
      ysTensor.dispose();

      await this.saveModel();
    } catch (error) {
      logger.error('Retraining failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'RenderTimePredictor',
      });
    }
  }

  /**
   * Extract feature vector from context
   */
  private extractFeatures(context: AnalysisContext): FeatureVector {
    return {
      renderCount: context.renderCount,
      wastedRenderRate: context.wastedRenderCount / Math.max(1, context.renderCount),
      componentDepth: this.estimateComponentDepth(context.componentName),
      childCount: context.childComponents?.length || 0,
      propCount: context.props?.length || 0,
      hasMemo: context.memoReport ? 1 : 0,
      hasCallback: context.hooks?.some(h => h.name === 'useCallback') ? 1 : 0,
      hasMemoizedProps: context.props?.filter(p => p.isStable).length || 0,
      averageRenderTime: context.averageRenderTime,
    };
  }

  /**
   * Apply optimization to feature vector
   */
  private applyOptimization(features: FeatureVector, optimization: string): FeatureVector {
    const optimized = { ...features };
    
    switch (true) {
      case optimization.includes('React.memo'):
        optimized.hasMemo = 1;
        optimized.wastedRenderRate *= 0.2; // 80% reduction
        break;
      case optimization.includes('useCallback'):
        optimized.hasCallback = 1;
        optimized.wastedRenderRate *= 0.7; // 30% reduction
        break;
      case optimization.includes('useMemo'):
        optimized.hasMemoizedProps += 1;
        optimized.wastedRenderRate *= 0.8; // 20% reduction
        break;
      case optimization.includes('colocate'):
        optimized.componentDepth = Math.max(1, optimized.componentDepth - 1);
        optimized.wastedRenderRate *= 0.5;
        break;
    }

    return optimized;
  }

  /**
   * Heuristic-based prediction (fallback)
   */
  private heuristicPredict(
    context: AnalysisContext,
    optimization: string
  ): PerformancePrediction {
    const currentTime = context.averageRenderTime;
    let improvementPercentage = 0;
    let reasoning = '';

    switch (true) {
      case optimization.includes('React.memo'):
        improvementPercentage = context.wastedRenderCount / Math.max(1, context.renderCount) * 100 * 0.8;
        reasoning = 'React.memo prevents unnecessary re-renders when props are stable';
        break;
      case optimization.includes('useCallback'):
        improvementPercentage = 15;
        reasoning = 'useCallback stabilizes function references for child components';
        break;
      case optimization.includes('useMemo'):
        improvementPercentage = 10;
        reasoning = 'useMemo caches expensive computations';
        break;
      case optimization.includes('colocate'):
        improvementPercentage = 20;
        reasoning = 'Colocating state reduces parent re-render scope';
        break;
      default:
        improvementPercentage = 10;
        reasoning = 'General optimization with estimated impact';
    }

    const optimizedTime = currentTime * (1 - improvementPercentage / 100);

    return {
      currentRenderTime: currentTime,
      predictedRenderTime: optimizedTime,
      improvementPercentage,
      confidence: 0.6,
      reasoning,
    };
  }

  /**
   * Calculate confidence based on feature coverage
   */
  private calculateConfidence(features: FeatureVector): number {
    // Higher confidence with more training data and reasonable feature values
    const dataConfidence = Math.min(0.9, this.trainingData.length / 100);
    const featureConfidence = features.renderCount > 10 ? 0.9 : 0.7;
    return (dataConfidence + featureConfidence) / 2;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(optimization: string, improvement: number): string {
    if (improvement > 50) {
      return `Major improvement expected. ${optimization} will significantly reduce render overhead.`;
    } else if (improvement > 20) {
      return `Good improvement expected. ${optimization} should noticeably improve performance.`;
    } else if (improvement > 10) {
      return `Moderate improvement expected. ${optimization} will help in specific scenarios.`;
    }
    return `Minor improvement expected. Consider combining with other optimizations.`;
  }

  /**
   * Estimate component depth from name
   */
  private estimateComponentDepth(name: string): number {
    // Rough heuristic: more nested names suggest deeper trees
    return name.split(/(?=[A-Z])/).length;
  }

  /**
   * Save model to storage
   */
  private async saveModel(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    try {
      const weights = this.model.getWeights().map((w: any) => ({
        data: Array.from(w.dataSync()),
        shape: w.shape,
      }));
      
      await chrome.storage.local.set({ [this.MODEL_KEY]: weights });
    } catch (error) {
      logger.error('Failed to save model', { error, source: 'RenderTimePredictor' });
    }
  }

  /**
   * Load model from storage
   */
  private async loadModel(): Promise<any> {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    
    try {
      const result = await chrome.storage.local.get(this.MODEL_KEY);
      if (!result[this.MODEL_KEY]) return null;

      const tf = await import('@tensorflow/tfjs');
      const weights = result[this.MODEL_KEY].map((w: any) => 
        tf.tensor(w.data, w.shape)
      );

      // Create and set weights
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [9], units: 16, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 1 }),
        ],
      });

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
      });

      model.setWeights(weights);
      return model;
    } catch (error) {
      logger.error('Failed to load model', { error, source: 'RenderTimePredictor' });
      return null;
    }
  }

  /**
   * Save training data
   */
  private async saveTrainingData(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    await chrome.storage.local.set({
      [this.TRAINING_DATA_KEY]: this.trainingData.slice(-100), // Keep last 100
    });
  }

  /**
   * Load training data
   */
  private async loadTrainingData(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    const result = await chrome.storage.local.get(this.TRAINING_DATA_KEY);
    this.trainingData = result[this.TRAINING_DATA_KEY] || [];
  }
}

// Singleton
let predictor: RenderTimePredictor | null = null;

export function getRenderTimePredictor(): RenderTimePredictor {
  if (!predictor) {
    predictor = new RenderTimePredictor();
  }
  return predictor;
}
