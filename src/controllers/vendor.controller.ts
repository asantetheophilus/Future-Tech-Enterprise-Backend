import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { sendResponse } from "../utils/response.js";

export const vendorController = {
  notImplemented(_req: Request, res: Response) {
    return sendResponse(res, {
      success: false,
      statusCode: StatusCodes.NOT_IMPLEMENTED,
      message: "Vendor module is prepared but not implemented yet", // [VENDOR READY]
      data: null
    });
  }
};
