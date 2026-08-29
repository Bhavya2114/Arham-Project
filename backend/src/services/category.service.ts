import { Category } from '../models/Category';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/category.validator';

export const getCategories = async (): Promise<any[]> => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  return categories.map((cat: any) => ({
    id: cat._id.toString(),
    name: cat.name,
    description: cat.description,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  }));
};

export const getCategoryById = async (id: string): Promise<any> => {
  const cat = await Category.findById(id).lean();
  if (!cat) return null;
  return {
    id: (cat as any)._id.toString(),
    name: (cat as any).name,
    description: (cat as any).description,
    createdAt: (cat as any).createdAt,
    updatedAt: (cat as any).updatedAt,
  };
};

export const createCategory = async (input: CreateCategoryInput): Promise<any> => {
  const existing = await Category.findOne({ name: new RegExp(`^${input.name}$`, 'i') });
  if (existing) {
    const error = new Error('Category with this name already exists');
    (error as any).statusCode = 400;
    throw error;
  }

  const category = await Category.create({
    name: input.name,
    description: input.description,
  });

  return getCategoryById(category._id.toString());
};

export const updateCategory = async (id: string, input: UpdateCategoryInput): Promise<any> => {
  const existing = await Category.findById(id);
  if (!existing) {
    const error = new Error('Category not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (input.name) {
    const duplicate = await Category.findOne({
      name: new RegExp(`^${input.name}$`, 'i'),
      _id: { $ne: id },
    });
    if (duplicate) {
      const error = new Error('Category with this name already exists');
      (error as any).statusCode = 400;
      throw error;
    }
  }

  await Category.findByIdAndUpdate(id, {
    name: input.name,
    description: input.description,
  });

  return getCategoryById(id);
};

export const deleteCategory = async (id: string): Promise<void> => {
  const existing = await Category.findById(id);
  if (!existing) {
    const error = new Error('Category not found');
    (error as any).statusCode = 404;
    throw error;
  }

  await Category.findByIdAndDelete(id);
};
