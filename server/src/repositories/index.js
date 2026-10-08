import { pool } from '../config/db.js';
import { UserRepository } from './UserRepository.js';
import { BazaarPriceRepository } from './BazaarPriceRepository.js';
import { CropRepository } from './CropRepository.js';
import { NegotiationRepository } from './NegotiationRepository.js';
import { MessageRepository } from './MessageRepository.js';
import { OrderRepository } from './OrderRepository.js';

export const userRepository = new UserRepository(pool);
export const bazaarPriceRepository = new BazaarPriceRepository(pool);
export const cropRepository = new CropRepository(pool);
export const negotiationRepository = new NegotiationRepository(pool);
export const messageRepository = new MessageRepository(pool);
export const orderRepository = new OrderRepository(
  pool,
  cropRepository,
  negotiationRepository
);
