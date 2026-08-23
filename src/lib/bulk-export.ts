/**
 * Bulk Recipe Export Utility
 * Exports all user recipes to Cooklang format in a single zip file
 */

import JSZip from 'jszip';
import { getAllRecipes, getRecipeById } from '@/api';
import { exportRecipeToCooklang } from './cooklang-exporter';
import type { RecipeWithDetails } from '@/types/types';

/**
 * Generate a safe filename from recipe title
 */
function generateSafeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100); // Limit length
}

/**
 * Export all user recipes to a zip file
 */
export async function exportAllRecipesToZip(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  try {
    // Fetch all recipes
    const recipes = await getAllRecipes();
    
    if (!recipes || recipes.length === 0) {
      throw new Error('No recipes found to export');
    }

    const zip = new JSZip();
    const total = recipes.length;

    // Process each recipe
    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }

      try {
        // Fetch full recipe details
        const fullRecipe = await getRecipeById(recipe.id);
        
        if (!fullRecipe) {
          console.warn(`Skipping recipe ${recipe.id}: not found`);
          continue;
        }

        // Convert to Cooklang format
        const cooklangContent = exportRecipeToCooklang(fullRecipe as RecipeWithDetails);
        
        // Generate filename
        const filename = generateSafeFilename(recipe.title) + '.cook';
        
        // Add to zip
        zip.file(filename, cooklangContent);
      } catch (error) {
        console.error(`Error exporting recipe ${recipe.title}:`, error);
        // Continue with other recipes
      }
    }

    // Generate zip file
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `pantrybutler-recipes-${timestamp}.zip`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw error;
  }
}
