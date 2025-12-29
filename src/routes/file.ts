import {readAllBitables} from "@/lib/localData";
import {Router} from "express";

const router = Router()

router.get('', (req, res) => {
    const data = readAllBitables();
    res.json(data);
})
export default router
